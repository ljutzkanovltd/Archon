# MiniMax-M2 Q6_K Download - Resume Instructions

**Project ID:** `912e41f4-c723-461c-a14e-af98a1f13606`
**Status:** PAUSED - Ready to resume
**Date Paused:** 2026-01-16
**Progress:** 0% (initialization phase)

---

## 🎯 PROJECT STATUS

### ✅ Completed Tasks

1. **Phase 1: Enhanced memory protection** - DONE
2. **Disk Space Cleanup** - DONE (323GB freed!)
   - Critical cleanup: 197GB
   - User caches: 81GB
   - Docker volumes: 45GB
   - **Result:** 348GB free (was 25GB)

### 🔄 Current Task

**Task:** Phase 2 - Download MiniMax-M2 Q6_K model
- **Status:** PAUSED (was stuck at initialization)
- **Repository:** `bartowski/MiniMaxAI_MiniMax-M2-GGUF`
- **Size:** 187.99GB (5 Q6_K files)
- **Available Space:** 348GB ✅

---

## 📋 DISK SPACE SUMMARY

| Metric | Value |
|--------|-------|
| **Starting disk space** | 25GB free (98% full) |
| **After cleanup** | 348GB free (61% used) |
| **Space freed** | 323GB total |
| **Download size** | 188GB |
| **After download** | 160GB free (estimated) |

---

## 🚀 RESUME DOWNLOAD SCRIPT

### Option 1: Basic Download (No Authentication)

```bash
cd ~/Documents/Projects/local-ai-packaged/models

# Start download
~/.local/bin/hf download bartowski/MiniMaxAI_MiniMax-M2-GGUF \
  --include "*Q6_K*.gguf" \
  --local-dir . \
  --max-workers 4 \
  2>&1 | tee /tmp/minimax_download.log &

# Monitor progress
tail -f /tmp/minimax_download.log

# Check downloaded files
watch -n 60 'ls -lh *Q6_K*.gguf 2>/dev/null && du -sh *Q6_K* 2>/dev/null'
```

### Option 2: With HuggingFace Token (Recommended - Faster)

```bash
cd ~/Documents/Projects/local-ai-packaged/models

# Set your HuggingFace token (get from https://huggingface.co/settings/tokens)
export HF_TOKEN="your_token_here"

# Start download with authentication
~/.local/bin/hf download bartowski/MiniMaxAI_MiniMax-M2-GGUF \
  --include "*Q6_K*.gguf" \
  --local-dir . \
  --max-workers 4 \
  --token "$HF_TOKEN" \
  2>&1 | tee /tmp/minimax_download.log &

# Monitor progress
tail -f /tmp/minimax_download.log
```

### Option 3: Download MiniMax-M2.1 (Newer Version)

```bash
cd ~/Documents/Projects/local-ai-packaged/models

# Download the newer M2.1 version
~/.local/bin/hf download bartowski/MiniMaxAI_MiniMax-M2.1-GGUF \
  --include "*Q6_K*.gguf" \
  --local-dir . \
  --max-workers 4 \
  2>&1 | tee /tmp/minimax_download.log &
```

### Option 4: Download Single File at a Time (Most Reliable)

```bash
cd ~/Documents/Projects/local-ai-packaged/models

# List available files first
~/.local/bin/hf ls bartowski/MiniMaxAI_MiniMax-M2-GGUF | grep Q6_K

# Download files one by one
~/.local/bin/hf download bartowski/MiniMaxAI_MiniMax-M2-GGUF \
  MiniMaxAI_MiniMax-M2-Q6_K-00001-of-00005.gguf \
  --local-dir .

# Repeat for each file (00002, 00003, 00004, 00005)
```

---

## 📊 EXPECTED FILES

The Q6_K quantization consists of 5 split files:

1. `MiniMaxAI_MiniMax-M2-Q6_K-00001-of-00005.gguf` (~38GB)
2. `MiniMaxAI_MiniMax-M2-Q6_K-00002-of-00005.gguf` (~38GB)
3. `MiniMaxAI_MiniMax-M2-Q6_K-00003-of-00005.gguf` (~38GB)
4. `MiniMaxAI_MiniMax-M2-Q6_K-00004-of-00005.gguf` (~38GB)
5. `MiniMaxAI_MiniMax-M2-Q6_K-00005-of-00005.gguf` (~36GB)

**Total:** ~188GB

---

## 🔍 MONITORING COMMANDS

### Check Download Progress

```bash
# Watch files being downloaded
watch -n 30 'ls -lh ~/Documents/Projects/local-ai-packaged/models/*Q6_K*.gguf'

# Check total downloaded size
du -sh ~/Documents/Projects/local-ai-packaged/models/*Q6_K*

# Monitor disk space
watch -n 60 'df -h / | grep ubuntu--vg'

# View download log
tail -f /tmp/minimax_download.log

# Check download process
ps aux | grep "hf download" | grep -v grep
```

### Calculate Progress

```bash
# Get total size of downloaded files
DOWNLOADED=$(du -sb ~/Documents/Projects/local-ai-packaged/models/*Q6_K* 2>/dev/null | awk '{sum+=$1}END{print sum/1024/1024/1024}')
TOTAL=188
PERCENT=$(echo "scale=2; $DOWNLOADED / $TOTAL * 100" | bc)
echo "Progress: ${PERCENT}% (${DOWNLOADED}GB / ${TOTAL}GB)"
```

---

## 🛠️ TROUBLESHOOTING

### If Download Fails/Hangs

1. **Check connectivity:**
   ```bash
   curl -I https://huggingface.co
   ```

2. **Clear cache and retry:**
   ```bash
   rm -rf ~/.cache/huggingface
   rm -rf ~/Documents/Projects/local-ai-packaged/models/.cache
   # Then restart download
   ```

3. **Use fewer workers:**
   ```bash
   # Try with --max-workers 2 or --max-workers 1
   ```

4. **Download via wget (if you have direct URLs):**
   ```bash
   wget -c https://huggingface.co/.../file.gguf
   ```

### If Out of Space

You still have Tier 3 cleanup options:
- Python venvs (football-platform): 15GB
- Pre-Archon migration backup: 4.6GB

```bash
# Clean Python venvs (if inactive)
rm -rf ~/Documents/Projects/thefootballplatform/backend/.venv
rm -rf ~/Documents/Projects/football-platform/backend/venv

# Clean old Archon migration backup (if confident)
rm -rf ~/Documents/Projects/local-ai-packaged/backups/pre_archon_migration_tracking_update/
```

---

## 📝 UPDATE ARCHON TASK

After resuming, update the task status:

```bash
# Mark task as "doing" when you resume
curl -s "http://localhost:8181/api/tasks/b6e5dd94-15e5-4797-bf8d-7fd1ff2ad416" \
  -X PUT -H "Content-Type: application/json" \
  -d '{"status": "doing", "description": "Resuming download..."}'

# Mark as "done" when complete
curl -s "http://localhost:8181/api/tasks/b6e5dd94-15e5-4797-bf8d-7fd1ff2ad416" \
  -X PUT -H "Content-Type: application/json" \
  -d '{"status": "done", "description": "Download complete! 188GB downloaded successfully."}'
```

---

## 🎯 NEXT STEPS AFTER DOWNLOAD

1. **Verify files:**
   ```bash
   ls -lh ~/Documents/Projects/local-ai-packaged/models/*Q6_K*.gguf
   md5sum ~/Documents/Projects/local-ai-packaged/models/*Q6_K*.gguf
   ```

2. **Continue with remaining phases:**
   - Phase 3: Q6_K-optimized Docker configuration
   - Phase 4: Dynamic model orchestration system
   - Phase 5: local-ai-packaged integration
   - Phase 6: Performance benchmarking
   - Phase 7: Documentation

3. **Test the model:**
   ```bash
   cd ~/Documents/Projects/local-ai-packaged
   # Update .env with new model
   # Restart services
   python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan
   ```

---

## 📚 REFERENCES

- **Project Dashboard:** http://localhost:3738/projects/912e41f4-c723-461c-a14e-af98a1f13606
- **Cleanup Report:** `~/Documents/Projects/archon/docs/cleanup_analysis_report_20260116.md`
- **Additional Cleanup:** `/tmp/additional_cleanup_opportunities.md`
- **HuggingFace Token:** https://huggingface.co/settings/tokens
- **Model Repository:** https://huggingface.co/bartowski/MiniMaxAI_MiniMax-M2-GGUF

---

**Document Version:** 1.0
**Last Updated:** 2026-01-16
**Status:** Ready to resume
**Disk Space Available:** 348GB ✅
