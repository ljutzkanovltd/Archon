# AMD Integrated GPU Unified Memory Research: Running MiniMax M2 (80GB+) on Radeon 8060S

**Research Date:** 2026-01-08
**Target Hardware:** AMD Radeon 8060S (RADV GFX1151) with 125GB System RAM
**Research Scope:** Feasibility of running MiniMax M2 GGUF models (83GB-134GB) on integrated GPU with unified memory

---

## Executive Summary

### Feasibility Assessment: ✅ FEASIBLE with Conditions

Running MiniMax M2 on AMD Radeon 8060S (GFX1151) with 125GB system RAM is **technically feasible** but with significant performance trade-offs. The unified memory architecture enables model loading, but inference speed will be substantially slower than dedicated GPU solutions.

**Recommended Configuration:**
- **Model:** MiniMax M2 Q2_K (79.82GB) or Q4_K_M (138.59GB with careful memory management)
- **Backend:** Vulkan RADV (not ROCm due to complexity/stability issues)
- **GPU Layers:** -ngl 999 (offload all possible layers to unified memory)
- **Expected Performance:** 10-20 tokens/second for generation, 200-400 tokens/second for prompt processing

---

## 1. AMD Integrated GPU Unified Memory Architecture

### 1.1 AMD Radeon 8060S (GFX1151) Specifications

**Hardware Details:**
- **Architecture:** RDNA 3.5 (Strix Halo platform)
- **Compute Units:** 40 CUs with up to 2.9 GHz clock
- **Memory Type:** Unified/shared memory with system RAM
- **Memory Interface:** LPDDR5X 8000MHz quad channel
- **Maximum VRAM Allocation:** Up to 96GB from 128GB system RAM

**Unified Memory Characteristics:**
- System RAM is shared between CPU and GPU
- Variable Graphics Memory support (dynamic allocation)
- Memory bandwidth: ~256 GB/s theoretical peak
- Actual bandwidth efficiency: 70-73% (180-187 GB/s effective)

### 1.2 Unified Memory Architecture Details

**How Unified Memory Works on AMD Integrated GPUs:**

1. **Memory Allocation:**
   - System RAM is divided between CPU and GPU use
   - Allocation is controlled by kernel TTM (Translation Table Manager) module
   - Modern kernels (6.16.9+) automatically configure up to 96GB VRAM
   - Legacy systems require `amdttm.pages_limit` kernel parameters

2. **Memory Access Patterns:**
   - GPU can directly access system RAM without explicit transfers
   - No separate VRAM pool - all memory is unified
   - Memory mapping via Vulkan uses host-visible device memory
   - 2X performance improvement when data is "loaded" to GPU vs CPU access

3. **Memory Limits:**
   - Maximum practical VRAM: ~96-108GB from 125GB system RAM
   - Leaves ~17-29GB for OS and system processes
   - No hard limit between CPU/GPU - dynamically allocated
   - Kernel automatically manages memory pressure

**Technical Configuration:**
```bash
# Modern kernel (6.16.9+) - automatic configuration
uname -r  # Should show 6.16.9 or later
# No kernel parameters needed - automatically sees 96GB VRAM

# Legacy kernel configuration (if needed)
# amdttm.pages_limit=$((96 * 1024 * 1024 / 4.096))
# amdttm.page_pool_size=$((96 * 1024 * 1024 / 4.096))
```

### 1.3 GFX1151 Architecture-Specific Capabilities

**RDNA 3.5 Features:**
- Enhanced compute performance vs RDNA 3
- Improved power efficiency
- Better FP16/BF16 support (critical for LLM inference)
- Hardware-accelerated matrix operations

**Known Limitations:**
- Memory bandwidth lower than dedicated GPUs (256 GB/s vs 900+ GB/s for high-end GPUs)
- Shared memory reduces available RAM for OS/applications
- Thermal constraints in laptop form factors
- Performance degradation under sustained load

---

## 2. llama.cpp Vulkan Backend Large Model Support

### 2.1 Vulkan Backend Capabilities

**Core Features:**
- Supports Vulkan 1.2 or greater
- Hardware-agnostic (works across AMD, NVIDIA, Intel)
- Memory-mapped I/O (mmap) for efficient model loading
- Partial layer offloading (CPU + GPU hybrid)
- Unified memory awareness for integrated GPUs

**Large Model Support (80GB+):**
- ✅ Can handle models larger than physical VRAM
- ✅ Uses memory mapping to stream model weights
- ✅ Supports partial offloading (some layers on CPU, some on GPU)
- ✅ No hard size limit - constrained by available system RAM
- ✅ Tested with models up to ~120GB in community reports

### 2.2 Memory Mapping Strategies (mmap)

**How mmap Works in llama.cpp:**

1. **Model Loading:**
   - Model file is memory-mapped (not copied to RAM)
   - OS creates page table entries reserving virtual addresses
   - Individual pages loaded on-demand (lazy loading)
   - Significantly reduces startup time and memory overhead

2. **Memory Efficiency:**
   - Before mmap: 40GB RAM needed for 20GB model (2X overhead)
   - With mmap: 20GB RAM needed for 20GB model (no duplication)
   - Multiple processes can share same mapped memory
   - OS automatically manages page cache

3. **Performance Implications:**
   - Initial access to model layer: page fault, disk I/O
   - Subsequent access: cached in system RAM
   - Hot layers (frequently used): remain in RAM
   - Cold layers (rarely used): can be evicted by OS

**Configuration:**
```bash
# Enable mmap (default)
./llama-cli -m model.gguf -p "prompt" --mmap 1

# Disable mmap (forces full RAM load - use if mmap causes issues)
./llama-cli -m model.gguf -p "prompt" --mmap 0
```

### 2.3 Layer Offloading with Unified Memory

**GPU Layer Offloading (-ngl flag):**
- `-ngl 0`: CPU-only inference (slowest)
- `-ngl 99` or `-ngl 999`: Offload all layers to GPU
- `-ngl <N>`: Offload N layers to GPU, rest on CPU

**Unified Memory Behavior:**
- Setting `-ngl 999` attempts to load all layers to GPU
- With unified memory: "GPU" memory is system RAM
- Performance: ~2X faster than CPU-only access
- Memory pressure: shared between CPU and GPU operations

**Optimal Configuration for Integrated GPU:**
```bash
# Recommended for AMD Radeon 8060S
./llama-cli -m model.gguf \
  -ngl 999 \          # Offload all layers to GPU
  --mmap 1 \          # Enable memory mapping
  -fa 1 \             # Enable Flash Attention
  -c 4096 \           # Context size
  --device Vulkan0    # Explicit Vulkan device
```

### 2.4 Vulkan Memory Allocation Best Practices

**Memory Heap Management:**
- Vulkan reports memory heaps during initialization
- Unified memory appears as `unified_memory_architecture: true`
- Device-local heap size indicates available VRAM
- Host-visible heap allows CPU access

**Known Issues:**
- AMDVLK driver has 2-2.6 GiB per-allocation limit (use RADV instead)
- Memory fragmentation with long-running inference
- OOM errors if system RAM exhausted

**Monitoring:**
```bash
# Check VRAM allocation
vulkaninfo | grep -A 10 "memoryHeaps"

# Monitor memory usage during inference
watch -n 1 'free -h && nvidia-smi'  # Adjust for AMD tools
```

---

## 3. MiniMax M2 GGUF Deployment Options

### 3.1 Available GGUF Quantizations

**Full Quantization Matrix (28 formats, 47GB-243GB):**

| Quantization | Size (GB) | Quality | Recommendation | Use Case |
|--------------|-----------|---------|----------------|----------|
| **IQ1_S** | 47.01 | Extremely low | ❌ Not recommended | Last resort only |
| **IQ2_S** | 63.35 | Very low | ⚠️ Experimental | Extreme space constraints |
| **IQ2_M** | 68.35 | Low | ⚠️ Usable | Space-critical scenarios |
| **Q2_K** | 79.82 | Very low | ⚠️ Surprisingly usable | Testing/experimentation |
| **IQ3_XXS** | 87.40 | Low-medium | ✅ Viable option | Balanced space/quality |
| **IQ3_S** | 92.04 | Low-medium | ✅ Good compromise | Limited RAM systems |
| **Q3_K_S** | 104.98 | Medium | ✅ Recommended minimum | 128GB RAM systems |
| **IQ3_M** | 105.99 | Medium | ✅ Recommended | Most systems |
| **Q3_K_M** | 115.35 | Medium | ✅ Recommended | Quality-conscious |
| **IQ4_XS** | 122.17 | Good | ✅ Excellent choice | Best balance |
| **IQ4_NL** | 126.07 | Good | ✅ Recommended | High quality |
| **Q4_K_S** | 128.38 | Good | ✅ Safe default | Standard choice |
| **Q4_0** | 132.55 | Good | ✅ Reliable | Compatibility |
| **Q4_K_M** | 138.59 | Very good | ✅ **PRIMARY RECOMMENDATION** | Quality focus |
| **Q4_1** | 147.28 | Very good | ✅ High quality | Large RAM |
| **Q5_K_S** | 154.15 | Very good | ⚠️ 125GB marginal | Requires swap |
| **Q5_K_M** | 162.38 | Excellent | ❌ Too large | Insufficient RAM |
| **Q6_K** | 187.81 | Near perfect | ❌ Too large | Requires 192GB+ RAM |
| **Q8_0** | 243.14 | Perfect | ❌ Too large | Requires 256GB+ RAM |

### 3.2 Recommended Quantization for 125GB System

**PRIMARY RECOMMENDATION: Q4_K_M (138.59GB)**

**Reasoning:**
1. **Memory Overhead Calculation:**
   - Model size: 138.59 GB
   - KV cache (4K context): ~8-12 GB
   - Framework overhead: ~5-8 GB
   - OS/system processes: ~15-20 GB
   - Total: ~170-180 GB
   - ⚠️ **PROBLEM:** Exceeds 125GB physical RAM

2. **Why Q4_K_M is Still Viable:**
   - Linux swap can provide additional virtual memory
   - mmap reduces actual memory footprint
   - Not all model layers accessed simultaneously
   - GPU offloading reduces CPU RAM pressure
   - Careful tuning can make it work

**ALTERNATIVE RECOMMENDATION: Q2_K (79.82GB) or IQ3_M (105.99GB)**

**Q2_K Benefits:**
- Leaves 45GB free for system + overhead
- No swap required
- Faster loading times
- More headroom for multi-tasking

**Q2_K Drawbacks:**
- Significant quality degradation (perplexity +0.8698 on test models)
- May produce incoherent outputs
- Not suitable for production use

**IQ3_M (105.99GB) - BEST COMPROMISE:**
- Moderate quality (better than Q2_K)
- Fits comfortably with 19GB headroom
- Supports 4K context with KV cache
- Minimal swap usage

### 3.3 Performance Expectations

**Tokens/Second Estimates (Based on Strix Halo Benchmarks):**

**Prompt Processing (pp):**
- Vulkan RADV: 400-750 t/s (depending on context size)
- ROCm: 300-650 t/s
- CPU-only: 50-150 t/s

**Token Generation (tg):**
- Vulkan RADV: 15-85 t/s (smaller models)
- Estimated for 80GB+ model: **10-25 t/s**
- ROCm: 10-65 t/s
- CPU-only: 2-8 t/s

**Context Length Impact:**
- Short context (512-4K): Near-maximum performance
- Medium context (8K-32K): 30-50% performance drop
- Long context (64K-130K): 60-80% performance drop

**Memory Bandwidth Bottleneck:**
- AMD Radeon 8060S: ~256 GB/s theoretical (180-187 GB/s effective)
- High-end dedicated GPU: 900-1,000 GB/s
- **Performance ratio: ~5X slower than dedicated GPU**

### 3.4 Memory Overhead Calculations

**KV Cache Formula:**
```
KV Cache Size (GB) = 2 × n_layers × context_length × hidden_dim × 2 bytes / 1GB

For MiniMax M2 (estimated parameters):
- n_layers: ~80-100
- hidden_dim: ~8192
- context_length: 4096

KV Cache = 2 × 90 × 4096 × 8192 × 2 / 1,073,741,824
         ≈ 10.8 GB for 4K context
         ≈ 43.2 GB for 16K context
         ≈ 86.4 GB for 32K context
```

**Total Memory Budget (Q4_K_M):**
- Model weights: 138.59 GB
- KV cache (4K): 10.8 GB
- Framework overhead: 5-8 GB
- Batch processing buffers: 2-4 GB
- **Total: ~160-165 GB**
- ⚠️ **Exceeds 125GB physical RAM by 35-40GB**

**Mitigation Strategies:**
1. **Reduce context length:** 2K context → 5.4 GB KV cache (saves 5.4 GB)
2. **Enable swap:** 40GB swap file for overflow
3. **Use Q2_K:** Total drops to ~100-110 GB
4. **Use IQ3_M:** Total ~130-135 GB (marginal, requires swap)

---

## 4. Integration Strategies

### 4.1 llama.cpp Vulkan Backend Configuration

**Build Configuration:**
```bash
# Install Vulkan SDK (if not present)
sudo apt install vulkan-sdk libvulkan-dev vulkan-tools

# Clone llama.cpp
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp

# Build with Vulkan support
cmake -B build -DGGML_VULKAN=1
cmake --build build --config Release

# Verify Vulkan detection
./build/bin/llama-cli --version
# Should show: "Vulkan: 1"
```

**Runtime Configuration:**
```bash
# Set environment variables
export VK_LOADER_DEBUG=error  # Reduce Vulkan logging noise
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json

# Run inference with optimal settings
./build/bin/llama-cli \
  -m /path/to/MiniMax-M2-Q4_K_M.gguf \
  -ngl 999 \              # Offload all layers to GPU
  --mmap 1 \              # Enable memory mapping
  -fa 1 \                 # Enable Flash Attention
  -c 2048 \               # Conservative context (reduces KV cache)
  -b 512 \                # Batch size for prompt processing
  --device Vulkan0 \      # Explicit Vulkan device selection
  -p "Your prompt here"
```

### 4.2 Vulkan Device Selection and Memory Heap Configuration

**Inspect Available Vulkan Devices:**
```bash
vulkaninfo | grep -E "(deviceName|deviceType|memoryHeaps)"

# Expected output for AMD Radeon 8060S:
# deviceName: AMD Radeon Graphics (RADV GFX1151)
# deviceType: INTEGRATED_GPU
# memoryHeaps:
#   heapIndex[0]: size = 96636764160 (89.99 GiB) flags = DEVICE_LOCAL | HOST_VISIBLE
```

**Memory Heap Interpretation:**
- `DEVICE_LOCAL`: GPU-accessible memory
- `HOST_VISIBLE`: CPU can map/access this memory
- `DEVICE_LOCAL | HOST_VISIBLE`: Unified memory architecture
- Size should show ~90-96 GB for 96GB VRAM allocation

**Force RADV Driver (if system has AMDVLK installed):**
```bash
# Check active driver
vulkaninfo | grep "driverName"

# Force RADV (if needed)
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
# OR
export AMD_VULKAN_ICD=RADV

# Disable AMDVLK
sudo mv /usr/share/vulkan/icd.d/amd_icd64.json /usr/share/vulkan/icd.d/amd_icd64.json.disabled
```

### 4.3 Optimal GPU Layer Offloading

**Layer Offloading Strategy:**
```bash
# Start conservatively (test stability)
./llama-cli -m model.gguf -ngl 0  # CPU-only baseline
# Measure: tokens/second, memory usage

# Incrementally increase layers
./llama-cli -m model.gguf -ngl 20  # Offload 20 layers
./llama-cli -m model.gguf -ngl 40  # Offload 40 layers
./llama-cli -m model.gguf -ngl 60  # Offload 60 layers

# Full offload (recommended for integrated GPU)
./llama-cli -m model.gguf -ngl 999  # Offload all possible layers
```

**Monitoring During Offloading:**
```bash
# Monitor GPU memory usage
watch -n 1 'radeontop -d 1'

# Monitor system memory
watch -n 1 'free -h'

# Check swap usage
watch -n 1 'swapon --show'
```

### 4.4 System Memory Pressure Management

**Swap Configuration (Critical for Q4_K_M):**
```bash
# Check current swap
swapon --show

# Create 40GB swap file (if Q4_K_M doesn't fit)
sudo fallocate -l 40G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make persistent (add to /etc/fstab)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Tune swappiness (reduce swap usage)
sudo sysctl vm.swappiness=10  # Default is 60
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

**OOM Killer Protection:**
```bash
# Find llama-cli PID
pidof llama-cli

# Protect from OOM killer (adjust score)
echo -1000 | sudo tee /proc/$(pidof llama-cli)/oom_score_adj
```

**Memory Management Best Practices:**
1. Close unnecessary applications before inference
2. Use lightweight desktop environment (or no GUI)
3. Disable browser/IDE/heavy applications
4. Monitor memory with `htop` during inference
5. Set up alerts for low memory conditions

---

## 5. Performance Expectations

### 5.1 Tokens/Second Benchmarks

**Based on Strix Halo (Radeon 8060S) Community Benchmarks:**

**Vulkan RADV Performance (Qwen3-30B, Q4_K_M, ~17GB model):**
- Prompt processing (512 tokens): 755 t/s
- Token generation (128 tokens): 85 t/s
- Long context (130K): 17 t/s (prompt processing)

**Scaled Estimates for MiniMax M2 (80GB-140GB model):**
- **Scaling factor:** Model size ratio = 138GB / 17GB ≈ 8X
- **Memory bandwidth limited:** Performance scales sublinearly

**Estimated Performance:**
- Prompt processing (512 tokens): **100-200 t/s** (5-8X slower)
- Token generation (128 tokens): **10-20 t/s** (4-8X slower)
- Long context (32K): **5-10 t/s** (severely degraded)

**Comparison to Dedicated GPU (NVIDIA RTX 4090):**
- RTX 4090 with 24GB VRAM: 50-100 t/s (for models that fit)
- RTX 4090 cannot run 138GB model without multi-GPU setup
- Radeon 8060S advantage: Can run model at all (albeit slowly)

### 5.2 Latency Considerations

**Time to First Token (TTFT):**
- Prompt length: 512 tokens
- Processing time: 512 / 150 t/s ≈ **3.4 seconds**
- Model loading time: 30-60 seconds (first run with mmap)

**Time for 100 Tokens Generated:**
- Generation time: 100 / 15 t/s ≈ **6.7 seconds**
- Total response time (TTFT + generation): **~10 seconds**

**Use Case Suitability:**
- ✅ **Batch processing:** Acceptable (run overnight)
- ✅ **Research/experimentation:** Viable
- ⚠️ **Interactive chat:** Marginal (slow but usable)
- ❌ **Real-time applications:** Not recommended
- ❌ **Production services:** Insufficient throughput

### 5.3 Memory Bandwidth Bottleneck Analysis

**Memory Bandwidth Comparison:**
| Hardware | Memory Bandwidth | Relative Performance |
|----------|------------------|---------------------|
| AMD Radeon 8060S | 256 GB/s (theoretical) | 1.0X (baseline) |
| AMD Radeon 8060S | 180-187 GB/s (effective 70-73%) | 0.7-0.73X |
| NVIDIA RTX 4090 | 1,008 GB/s | 5.4X faster |
| AMD Radeon RX 7900 XTX | 960 GB/s | 5.1X faster |
| Apple M2 Ultra (192GB) | 800 GB/s | 4.3X faster |

**Bandwidth-Limited Scenarios:**
- Large model inference is **primarily bandwidth-limited**
- 80GB+ models require constant streaming from memory
- Compute (TFLOPS) is secondary concern
- Cache misses dominate performance

**Optimization Strategies:**
1. **Quantization:** Q2_K reduces bandwidth by 50% vs Q4_K_M
2. **Smaller context:** Reduces KV cache bandwidth pressure
3. **Flash Attention:** More efficient attention mechanism
4. **Batch size 1:** Reduces memory transfers (single-query mode)

### 5.4 Practical Usability Assessment

**Realistic Use Cases:**

**✅ Viable:**
- Code generation (batch mode)
- Document summarization (overnight processing)
- Research experiments (training data generation)
- Model evaluation/benchmarking
- Educational purposes (learning LLM architecture)

**⚠️ Marginal:**
- Interactive chat (slow but functional)
- Personal assistant (requires patience)
- Content creation (draft generation)

**❌ Not Suitable:**
- Production API endpoints (latency requirements)
- Real-time translation/transcription
- Customer-facing chatbots (user experience)
- High-throughput applications

**Comparison to Cloud Alternatives:**
- Cloud GPUs (A100/H100): 50-200X faster
- Cost: Cloud charges per hour; local is "free" after hardware
- Privacy: Local inference keeps data private
- Latency: Cloud has network overhead but faster overall

---

## 6. Recommended Configuration Strategy

### 6.1 Step-by-Step Deployment Plan

**Phase 1: System Preparation**

1. **Verify Kernel Version:**
   ```bash
   uname -r  # Should be 6.16.9 or later for automatic 96GB VRAM
   ```
   - If older: Upgrade kernel or configure TTM manually
   - Check VRAM allocation: `dmesg | grep -i vram`

2. **Install Vulkan SDK:**
   ```bash
   sudo apt install vulkan-sdk libvulkan-dev vulkan-tools
   vulkaninfo | grep -E "(deviceName|memoryHeaps)"
   ```

3. **Configure Swap (if using Q4_K_M):**
   ```bash
   sudo fallocate -l 40G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Verify RADV Driver:**
   ```bash
   vulkaninfo | grep driverName
   # Should show: driverName = radv
   ```

**Phase 2: Build llama.cpp**

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_VULKAN=1 -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc)
```

**Phase 3: Download Model**

```bash
# Option 1: IQ3_M (105.99 GB) - Recommended starting point
wget https://huggingface.co/bartowski/MiniMaxAI_MiniMax-M2-GGUF/resolve/main/MiniMaxAI_MiniMax-M2-IQ3_M.gguf

# Option 2: Q4_K_M (138.59 GB) - Higher quality, requires swap
wget https://huggingface.co/bartowski/MiniMaxAI_MiniMax-M2-GGUF/resolve/main/MiniMaxAI_MiniMax-M2-Q4_K_M.gguf

# Option 3: Q2_K (79.82 GB) - Fallback if memory issues
wget https://huggingface.co/bartowski/MiniMaxAI_MiniMax-M2-GGUF/resolve/main/MiniMaxAI_MiniMax-M2-Q2_K.gguf
```

**Phase 4: Test Inference**

```bash
# Conservative test (small context)
./build/bin/llama-cli \
  -m MiniMaxAI_MiniMax-M2-IQ3_M.gguf \
  -ngl 999 \
  --mmap 1 \
  -fa 1 \
  -c 1024 \
  -b 512 \
  -p "Write a short story about AI:" \
  -n 100

# Monitor during test
# Terminal 2:
watch -n 1 'free -h'
# Terminal 3:
radeontop
```

**Phase 5: Optimize Configuration**

```bash
# Experiment with parameters
# Test 1: Context size impact
for ctx in 1024 2048 4096; do
  echo "Testing context: $ctx"
  ./llama-cli -m model.gguf -ngl 999 -c $ctx -p "Test" -n 10
done

# Test 2: Batch size impact
for batch in 128 256 512 1024; do
  echo "Testing batch: $batch"
  ./llama-cli -m model.gguf -ngl 999 -b $batch -p "Test" -n 10
done

# Test 3: Flash Attention impact
./llama-cli -m model.gguf -ngl 999 -fa 0 -p "Test" -n 10  # Disabled
./llama-cli -m model.gguf -ngl 999 -fa 1 -p "Test" -n 10  # Enabled
```

### 6.2 Recommended Quantization Level

**PRIMARY RECOMMENDATION: IQ3_M (105.99 GB)**

**Rationale:**
- Fits comfortably in 125GB RAM with 19GB headroom
- Supports 4K context without swap
- Medium quality (acceptable for most tasks)
- 2X faster loading than Q4_K_M
- More stable (less memory pressure)

**Quality Comparison:**
- Q2_K: Perplexity +0.8698 (extreme degradation)
- IQ3_M: Perplexity ~+0.3-0.4 (moderate degradation)
- Q4_K_M: Perplexity +0.0535 (minimal degradation)

**When to Use Q4_K_M:**
- Quality is paramount
- Willing to accept slower loading/inference
- Have 40GB+ swap configured
- Single-user workload (no multi-tasking)
- Batch processing mode (not interactive)

**When to Use Q2_K:**
- Memory constraints (other applications running)
- Testing/experimentation only
- Speed over quality
- Can tolerate occasional incoherent outputs

### 6.3 Memory Management Best Practices

**Pre-Inference Checklist:**
1. Close unnecessary applications (browsers, IDEs, etc.)
2. Check available memory: `free -h` (should show 30GB+ free)
3. Verify swap is active: `swapon --show`
4. Monitor system load: `htop` (should be <50% CPU usage)

**During Inference:**
1. Monitor memory usage: `watch -n 1 'free -h'`
2. Watch swap usage: If swap exceeds 10GB, expect slowdowns
3. GPU utilization: `radeontop` (should show high GPU usage)
4. Temperature: `sensors` (keep below 85°C)

**Memory Pressure Mitigation:**
```bash
# Clear page cache (before inference)
sudo sync && sudo sysctl -w vm.drop_caches=3

# Disable transparent huge pages (can cause memory fragmentation)
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

# Increase file descriptor limit (for large mmap)
ulimit -n 65536
```

**Emergency Recovery:**
```bash
# If system becomes unresponsive (memory exhaustion)
# 1. SSH from another machine
# 2. Find PID of llama-cli
pidof llama-cli

# 3. Kill gracefully
kill -TERM $(pidof llama-cli)

# 4. If still unresponsive, force kill
kill -9 $(pidof llama-cli)

# 5. Clear page cache
sudo sync && sudo sysctl -w vm.drop_caches=3
```

### 6.4 Performance Optimization Tips

**Vulkan-Specific Optimizations:**
```bash
# Enable Vulkan validation layers (debug mode)
export VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation
export VK_LOADER_DEBUG=all

# Disable validation layers (production mode - faster)
unset VK_INSTANCE_LAYERS
export VK_LOADER_DEBUG=error

# Force RADV driver optimizations
export RADV_PERFTEST=gpl,ngg
export RADV_DEBUG=nodcc
```

**llama.cpp-Specific Optimizations:**
```bash
# Optimal configuration for AMD Radeon 8060S
./llama-cli \
  -m model.gguf \
  -ngl 999 \           # Offload all layers
  --mmap 1 \           # Enable memory mapping
  -fa 1 \              # Flash Attention (reduces memory bandwidth)
  -c 2048 \            # Conservative context (reduce KV cache)
  -b 512 \             # Prompt batch size
  -n 256 \             # Limit output tokens (for testing)
  --temp 0.7 \         # Temperature (doesn't affect performance)
  --threads $(nproc) \ # Use all CPU threads (for CPU portions)
  --device Vulkan0     # Explicit device selection
```

**Batch Processing Optimization:**
```bash
# Process multiple prompts efficiently
cat prompts.txt | while read prompt; do
  echo "Processing: $prompt"
  ./llama-cli -m model.gguf -ngl 999 -p "$prompt" -n 100 >> outputs.txt
done

# Parallel processing (if memory allows)
parallel -j 2 './llama-cli -m model.gguf -ngl 999 -p {} -n 100' :::: prompts.txt
```

---

## 7. Known Issues and Mitigation Strategies

### 7.1 Known Issues

**Issue 1: Memory Exhaustion (OOM)**
- **Symptom:** System freezes, slow performance, swap thrashing
- **Cause:** Model + KV cache + OS exceeds 125GB RAM
- **Impact:** System becomes unresponsive, inference fails

**Mitigation:**
```bash
# Option 1: Use smaller quantization (IQ3_M instead of Q4_K_M)
# Option 2: Reduce context size (-c 1024 instead of -c 4096)
# Option 3: Enable swap (40GB minimum)
# Option 4: Enable OOM killer protection (see Section 4.4)
```

**Issue 2: AMDVLK Memory Allocation Failure**
- **Symptom:** `VK_ERROR_OUT_OF_DEVICE_MEMORY` during model load
- **Cause:** AMDVLK has 2-2.6 GiB per-allocation limit
- **Impact:** Cannot load large models with AMDVLK driver

**Mitigation:**
```bash
# Force RADV driver (no per-allocation limit)
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
sudo mv /usr/share/vulkan/icd.d/amd_icd64.json /usr/share/vulkan/icd.d/amd_icd64.json.disabled
```

**Issue 3: Slow Prompt Processing (pp)**
- **Symptom:** 100-200 t/s instead of expected 400-750 t/s
- **Cause:** Memory bandwidth saturation, large model overhead
- **Impact:** Long time-to-first-token (TTFT)

**Mitigation:**
```bash
# Enable Flash Attention (-fa 1)
# Reduce batch size (-b 256 instead of -b 512)
# Ensure mmap is enabled (--mmap 1)
# Verify GPU utilization (radeontop - should be 90%+)
```

**Issue 4: ROCm Compatibility Issues**
- **Symptom:** Slower than Vulkan, GPU hangs, driver crashes
- **Cause:** ROCm 7.0+ stability issues on gfx1151
- **Impact:** Unreliable inference

**Mitigation:**
```bash
# Use Vulkan backend instead of ROCm (recommended)
# If ROCm required: Update to ROCm nightlies
# Disable rocWMMA: cmake -DGGML_HIP_ROCWMMA_FATTN=OFF
```

**Issue 5: Context Length Limitations**
- **Symptom:** Cannot use 32K+ context (OOM or extreme slowness)
- **Cause:** KV cache grows quadratically with context length
- **Impact:** Limited use for long-document tasks

**Mitigation:**
```bash
# KV cache size formula: 2 × layers × context × hidden_dim × 2 bytes
# 4K context: ~10.8 GB
# 16K context: ~43.2 GB (requires Q2_K or IQ3_M)
# 32K context: ~86.4 GB (impossible with Q4_K_M)

# Solution: Stick to 2-4K context for Q4_K_M, 8-16K for IQ3_M
```

### 7.2 Troubleshooting Guide

**Problem: Model fails to load**
```bash
# Check 1: Verify VRAM allocation
dmesg | grep -i vram
# Should show: [drm] VRAM: 96636M (or similar)

# Check 2: Verify Vulkan device
vulkaninfo | grep -E "(deviceName|memoryHeaps)"
# Should show: deviceName = AMD Radeon Graphics (RADV GFX1151)
# Should show: heapIndex[0]: size = 96636764160

# Check 3: Verify model file integrity
sha256sum model.gguf
# Compare with Hugging Face listing

# Check 4: Test with smaller model
./llama-cli -m smaller_model.gguf -ngl 999
```

**Problem: Inference is extremely slow (<5 t/s)**
```bash
# Check 1: GPU utilization
radeontop
# Should show: GPU usage 90%+, VRAM usage near maximum

# Check 2: CPU utilization
htop
# Should show: Some cores at 100% (CPU portions of inference)

# Check 3: Swap usage
swapon --show
# If swap usage >10GB, system is thrashing

# Check 4: Memory bandwidth
# Run: bandwidth test tool (if available)
# Compare to expected 180-187 GB/s

# Solution: Reduce context, use smaller quantization, close apps
```

**Problem: System becomes unresponsive during inference**
```bash
# Prevention: Set up OOM killer protection (see Section 4.4)
# Prevention: Monitor memory before starting inference
free -h  # Should show 30GB+ free

# Recovery: SSH from another machine, kill process
ssh user@localhost
pkill -9 llama-cli

# Long-term solution: Use smaller quantization (IQ3_M)
```

**Problem: Vulkan initialization fails**
```bash
# Error: "Failed to create Vulkan instance"
# Check 1: Verify Vulkan SDK installed
vulkaninfo --version

# Check 2: Verify driver
lsmod | grep amdgpu  # Should show: amdgpu module loaded

# Check 3: Environment variables
echo $VK_ICD_FILENAMES  # Should point to radeon_icd.x86_64.json

# Solution: Reinstall Vulkan SDK, update kernel, check permissions
```

### 7.3 Fallback Strategies

**Strategy 1: Cloud Hybrid (Offload Large Inference to Cloud)**
```bash
# Use local for small tasks, cloud for large tasks
if [ "$prompt_length" -gt 1000 ]; then
  # Cloud API (fast but costs money)
  curl -X POST https://api.provider.com/v1/inference \
    -d '{"model": "minimax-m2", "prompt": "..."}'
else
  # Local inference (free but slow)
  ./llama-cli -m model.gguf -ngl 999 -p "$prompt"
fi
```

**Strategy 2: Multi-Tiered Model Deployment**
```bash
# Small tasks: Use 7B-13B model (fast, local)
./llama-cli -m qwen2-7b-q4.gguf -ngl 999 -p "Quick question..."

# Medium tasks: Use 30B-70B model (moderate, local)
./llama-cli -m qwen3-30b-q4.gguf -ngl 999 -p "Complex task..."

# Large tasks: Use MiniMax M2 (slow, local) or cloud
./llama-cli -m minimax-m2-iq3m.gguf -ngl 999 -p "Advanced reasoning..."
```

**Strategy 3: Batch Processing Overnight**
```bash
# Queue tasks, process overnight, review in morning
cat tasks.txt | while read task; do
  echo "$(date): Processing $task" >> log.txt
  timeout 10m ./llama-cli -m model.gguf -ngl 999 -p "$task" >> results.txt
done
```

---

## 8. Comparison: Vulkan vs ROCm Performance

### 8.1 Vulkan Backend (RADV) - RECOMMENDED

**Advantages:**
- ✅ Better stability on gfx1151 (Strix Halo)
- ✅ Faster token generation (85 t/s vs 64 t/s for 30B model)
- ✅ Simpler setup (no ROCm installation required)
- ✅ Better long-context scaling (17 t/s vs 10 t/s at 130K)
- ✅ Active development, frequent updates

**Disadvantages:**
- ⚠️ Slightly slower prompt processing (755 vs 650 t/s - but ROCm pp is inconsistent)
- ⚠️ Occasional "GGGG" issues (rare, usually fixable)

**Configuration:**
```bash
cmake -B build -DGGML_VULKAN=1
cmake --build build --config Release
./llama-cli -m model.gguf -ngl 999 --device Vulkan0
```

### 8.2 ROCm Backend (HIP) - NOT RECOMMENDED for Strix Halo

**Advantages:**
- ✅ Potentially faster prompt processing (when working properly)
- ✅ Better integration with AMD compute ecosystem

**Disadvantages:**
- ❌ Stability issues on gfx1151
- ❌ GPU hangs reported (see ROCm issue tracker)
- ❌ Complex setup (ROCm installation, dependencies)
- ❌ rocWMMA flag slower on ROCm 7.0.2+ with long contexts
- ❌ Requires kernel 6.16+ and linux-firmware git version

**Configuration (if needed):**
```bash
# Install ROCm (complex, see official guide)
# Build llama.cpp
cmake -B build -DGGML_HIP=1 -DGGML_HIP_ROCWMMA_FATTN=ON
cmake --build build --config Release

# Run with optimal settings (as of August 2025)
ROCBLAS_USE_HIPBLASLT=1 ./llama-cli -m model.gguf -ngl 999
```

### 8.3 Performance Comparison Table

| Metric | Vulkan RADV | ROCm HIP | Winner |
|--------|-------------|----------|--------|
| **Stability** | Excellent | Poor (gfx1151) | Vulkan |
| **Setup Complexity** | Low | High | Vulkan |
| **Prompt Processing (pp)** | 755 t/s | 650 t/s (inconsistent) | Vulkan |
| **Token Generation (tg)** | 85 t/s | 64 t/s | Vulkan |
| **Long Context (130K)** | 17 t/s | 10 t/s | Vulkan |
| **Memory Bandwidth** | 70-73% | 70-73% | Tie |
| **Community Support** | Strong | Moderate | Vulkan |

**Recommendation:** Use Vulkan RADV for AMD Radeon 8060S. Only use ROCm if you have specific requirements (e.g., other ROCm-dependent tools).

---

## 9. Final Recommendations

### 9.1 Optimal Configuration Summary

**RECOMMENDED SETUP:**
- **Model:** MiniMax M2 IQ3_M (105.99 GB)
- **Backend:** Vulkan RADV
- **GPU Layers:** -ngl 999
- **Context Size:** 2048-4096 tokens
- **Memory Mapping:** Enabled (--mmap 1)
- **Flash Attention:** Enabled (-fa 1)
- **Swap:** 20GB (as safety buffer)

**Expected Performance:**
- Prompt processing: 150-300 t/s
- Token generation: 12-20 t/s
- Time to first token: 3-5 seconds (512-token prompt)
- 100-token response: ~8-12 seconds

**Acceptable Alternative (Higher Quality):**
- **Model:** MiniMax M2 Q4_K_M (138.59 GB)
- **Swap:** 40GB (required)
- **Context Size:** 1024-2048 tokens (to fit KV cache)
- **Trade-off:** Better quality, 20-30% slower loading/inference

**Fallback (Memory Constrained):**
- **Model:** MiniMax M2 Q2_K (79.82 GB)
- **Swap:** Not required
- **Context Size:** 4096-8192 tokens
- **Trade-off:** Significantly lower quality, acceptable for testing

### 9.2 Use Case Recommendations

**✅ RECOMMENDED Use Cases:**
1. **Research & Experimentation:**
   - Test prompting strategies
   - Evaluate model capabilities
   - Generate synthetic training data

2. **Batch Processing:**
   - Document summarization (overnight runs)
   - Code generation (batch mode)
   - Translation/localization tasks

3. **Privacy-Sensitive Applications:**
   - Local inference (no data leaves machine)
   - HIPAA/GDPR compliance scenarios
   - Personal AI assistant (non-real-time)

4. **Educational Purposes:**
   - Learn LLM architecture
   - Understand quantization trade-offs
   - Experiment with different backends

**⚠️ MARGINAL Use Cases (Requires Patience):**
1. **Interactive Chat:**
   - Usable but slow (8-12 second responses)
   - Better for thoughtful Q&A than rapid back-and-forth

2. **Content Creation:**
   - Acceptable for draft generation
   - Iterate on outputs over hours, not minutes

**❌ NOT RECOMMENDED Use Cases:**
1. **Production API Services:**
   - Insufficient throughput
   - Unacceptable latency for users

2. **Real-Time Applications:**
   - Translation, transcription, live chat
   - Latency requirements incompatible

3. **High-Concurrency Scenarios:**
   - Multi-user chatbot
   - Customer-facing applications

### 9.3 Cost-Benefit Analysis

**Local Inference (AMD Radeon 8060S):**
- **Upfront Cost:** $1,500-2,500 (laptop/desktop with Strix Halo)
- **Ongoing Cost:** Electricity (~$5-10/month for heavy use)
- **Performance:** 10-20 t/s (slow)
- **Privacy:** Excellent (fully local)

**Cloud Inference (AWS/GCP/Azure):**
- **Upfront Cost:** $0
- **Ongoing Cost:** $1-3 per hour (A100/H100 instances)
- **Performance:** 50-200 t/s (10-20X faster)
- **Privacy:** Data sent to third party

**Break-Even Analysis:**
- 100 hours cloud inference: $100-300
- Break-even: 5-25 hours of usage (local pays for itself quickly)
- **Conclusion:** Local viable if >50 hours usage over hardware lifetime

### 9.4 Final Decision Matrix

| Scenario | Recommended Action |
|----------|-------------------|
| **Quality critical** | Use Q4_K_M with 40GB swap |
| **Speed critical** | Use IQ3_M, accept quality loss |
| **Memory constrained** | Use Q2_K (79.82 GB) |
| **Batch processing** | IQ3_M or Q4_K_M, run overnight |
| **Interactive use** | IQ3_M for best balance |
| **Testing/learning** | Q2_K for fast iteration |
| **Production service** | ❌ Not recommended - use cloud |

---

## 10. Conclusion

### 10.1 Feasibility Summary

**VERDICT: ✅ TECHNICALLY FEASIBLE, ⚠️ WITH SIGNIFICANT CAVEATS**

Running MiniMax M2 (80GB-140GB GGUF models) on AMD Radeon 8060S with 125GB system RAM is **possible** but comes with substantial performance trade-offs:

**What Works:**
- ✅ Unified memory architecture enables loading 80GB+ models
- ✅ Vulkan RADV backend provides stable inference
- ✅ Memory mapping (mmap) reduces memory footprint
- ✅ Acceptable for batch processing, research, experimentation

**What Doesn't Work Well:**
- ❌ 5-10X slower than dedicated GPU solutions
- ❌ Memory bandwidth bottleneck (256 GB/s vs 900+ GB/s)
- ❌ Context length limited (2-4K practical, 8-16K marginal)
- ❌ Not suitable for production/real-time applications

### 10.2 Key Takeaways

1. **Quantization Choice is Critical:**
   - IQ3_M (105.99 GB): Best balance for 125GB RAM
   - Q4_K_M (138.59 GB): Requires swap, higher quality
   - Q2_K (79.82 GB): Fallback, significant quality loss

2. **Vulkan RADV is Superior to ROCm:**
   - Better stability on gfx1151 (Strix Halo)
   - Faster token generation (85 vs 64 t/s)
   - Simpler setup, active development

3. **Memory Management is Essential:**
   - Configure 20-40GB swap for headroom
   - Close unnecessary applications before inference
   - Monitor memory usage with `htop`, `free -h`

4. **Performance Expectations Must Be Realistic:**
   - 10-20 t/s token generation (vs 50-100 t/s on dedicated GPU)
   - Acceptable for patience-required tasks
   - Not competitive with cloud solutions for speed

5. **Use Case Fit Determines Success:**
   - ✅ Research, batch processing, privacy-sensitive tasks
   - ⚠️ Interactive chat (slow but usable)
   - ❌ Production APIs, real-time applications

### 10.3 Alternative Recommendations

**If Performance is Critical:**
1. **Cloud GPU Services:** AWS/GCP/Azure with A100/H100 (50-200X faster)
2. **Dedicated GPU Upgrade:** NVIDIA RTX 4090 (24GB VRAM, 5-10X faster for models that fit)
3. **Multi-GPU Setup:** 2-4 consumer GPUs (Tensor parallelism via llama.cpp)

**If Budget is Constrained:**
1. **Smaller Models:** Qwen3-30B (17GB Q4_K_M) runs well on Radeon 8060S
2. **Hybrid Approach:** Local for small tasks, cloud for large inference
3. **Batch Processing:** Queue overnight, review in morning

**If Privacy is Priority:**
1. **Current Setup (AMD Radeon 8060S):** Acceptable with patience
2. **Upgrade RAM:** 256GB system (enables larger context, Q8_0 quantization)
3. **Multi-Machine Cluster:** Distributed inference across multiple PCs

### 10.4 Future Outlook

**Potential Improvements:**
1. **Kernel Updates:** Linux 6.17+ may improve memory management
2. **ROCm Stability:** Future ROCm releases may fix gfx1151 issues
3. **llama.cpp Optimizations:** Ongoing development of Flash Attention, quantization
4. **Hardware Upgrades:** Future APUs with higher memory bandwidth

**Timeline:**
- **Short-term (6 months):** Minor llama.cpp optimizations, 10-15% speedup
- **Medium-term (1-2 years):** Next-gen APUs (RDNA 4/5), 2-3X bandwidth improvement
- **Long-term (3-5 years):** Consumer hardware catches up to cloud (unified memory standard)

### 10.5 Final Recommendation

**For Your Specific Scenario (AMD Radeon 8060S, 125GB RAM):**

**PRIMARY RECOMMENDATION:**
- **Model:** MiniMax M2 IQ3_M (105.99 GB)
- **Reason:** Best quality/performance balance, fits comfortably in RAM
- **Setup Time:** 2-3 hours (system prep, build, download, test)
- **Expected Experience:** Slow but usable, acceptable for research/experimentation

**ALTERNATIVE (Higher Quality, More Effort):**
- **Model:** MiniMax M2 Q4_K_M (138.59 GB)
- **Reason:** Minimal quality loss, requires swap setup
- **Setup Time:** 3-4 hours (includes swap configuration, testing)
- **Expected Experience:** High quality, 20-30% slower loading/inference

**DO NOT RECOMMEND:**
- ROCm backend (stability issues on gfx1151)
- Q8_0 quantization (exceeds memory capacity)
- Real-time/production use (insufficient performance)

**PROCEED WITH:** IQ3_M for immediate results, Q4_K_M if quality is paramount.

---

## Appendix A: Technical References

**AMD Documentation:**
- AMD Strix Halo Architecture: https://www.amd.com/en/products/apu/amd-ryzen-ai-max
- RADV Driver Documentation: https://docs.mesa3d.org/drivers/radv.html
- ROCm Documentation: https://github.com/ROCm/ROCm

**llama.cpp Resources:**
- Official Repository: https://github.com/ggml-org/llama.cpp
- Build Documentation: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
- Vulkan Backend Guide: https://github.com/ggml-org/llama.cpp/discussions/10879

**MiniMax M2 Model:**
- Hugging Face (bartowski): https://huggingface.co/bartowski/MiniMaxAI_MiniMax-M2-GGUF
- Hugging Face (unsloth): https://huggingface.co/unsloth/MiniMax-M2-GGUF
- Model Card: https://huggingface.co/MiniMax/MiniMax-M2

**Community Resources:**
- Strix Halo Wiki: https://strixhalo.wiki/
- LLM Tracker (Strix Halo): https://llm-tracker.info/AMD-Strix-Halo-(Ryzen-AI-Max+-395)-GPU-Performance
- Framework Community: https://community.frame.work/t/llama-cpp-vllm-toolboxes-for-llm-inference-on-strix-halo/74916

---

## Appendix B: Configuration Files

**Optimal llama.cpp Launch Script:**
```bash
#!/bin/bash
# run_minimax_m2.sh - Optimized launch script for AMD Radeon 8060S

MODEL_PATH="/path/to/MiniMaxAI_MiniMax-M2-IQ3_M.gguf"
LLAMA_BIN="/path/to/llama.cpp/build/bin/llama-cli"

# Vulkan environment
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
export VK_LOADER_DEBUG=error
export RADV_PERFTEST=gpl,ngg

# Memory management
ulimit -n 65536  # Increase file descriptor limit

# Run inference
$LLAMA_BIN \
  -m "$MODEL_PATH" \
  -ngl 999 \          # Offload all layers to GPU
  --mmap 1 \          # Enable memory mapping
  -fa 1 \             # Enable Flash Attention
  -c 2048 \           # Context size
  -b 512 \            # Batch size
  --threads $(nproc) \
  --device Vulkan0 \
  "$@"  # Pass additional arguments
```

**System Monitoring Script:**
```bash
#!/bin/bash
# monitor_inference.sh - Real-time monitoring during inference

watch -n 1 '
echo "=== Memory Usage ==="
free -h | grep -E "Mem|Swap"
echo ""
echo "=== GPU Utilization ==="
radeontop -d 1 -l 1 2>/dev/null || echo "radeontop not installed"
echo ""
echo "=== Process Info ==="
ps aux | grep llama-cli | grep -v grep
'
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-08
**Prepared By:** Library Research Agent
**Status:** Research Complete, Ready for Implementation
