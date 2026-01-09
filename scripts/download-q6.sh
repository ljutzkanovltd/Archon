#!/bin/bash
# Download MiniMax-M2 Q6_K Model
# Size: 187.99GB
# Source: HuggingFace - unsloth/MiniMax-M2.1-GGUF

set -e

MODEL_DIR="$HOME/Documents/Projects/archon/models/minimax-m2"
MODEL_FILE="MiniMax-M2.1-Q6_K.gguf"
EXPECTED_SIZE=187990000000  # ~188GB in bytes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════╗"
echo "║  MiniMax-M2 Q6_K Download              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Model: MiniMax-M2.1-Q6_K"
echo "Size: 187.99 GB"
echo "Destination: $MODEL_DIR"
echo ""

# Create directory
mkdir -p "$MODEL_DIR"
cd "$MODEL_DIR"

# Check if already downloaded
if [ -f "$MODEL_FILE" ]; then
    CURRENT_SIZE=$(stat -f%z "$MODEL_FILE" 2>/dev/null || stat -c%s "$MODEL_FILE" 2>/dev/null)
    echo -e "${YELLOW}⚠️  File already exists ($(numfmt --to=iec-i --suffix=B $CURRENT_SIZE))${NC}"

    if [ "$CURRENT_SIZE" -ge "$EXPECTED_SIZE" ]; then
        echo -e "${GREEN}✅ File appears complete${NC}"
        read -p "Re-download anyway? [y/N]: " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "Skipping download."
            exit 0
        fi
    else
        echo -e "${YELLOW}⚠️  File incomplete. Will attempt to resume.${NC}"
    fi
fi

# Method 1: Try huggingface-cli (best, supports resume)
if command -v huggingface-cli &> /dev/null; then
    echo -e "${GREEN}Using huggingface-cli (supports resume)${NC}"
    echo ""

    huggingface-cli download unsloth/MiniMax-M2.1-GGUF \
        "$MODEL_FILE" \
        --local-dir . \
        --local-dir-use-symlinks False \
        --resume-download

    echo ""
    echo -e "${GREEN}✅ Download complete via huggingface-cli${NC}"
    exit 0
fi

# Method 2: wget (supports resume with -c)
if command -v wget &> /dev/null; then
    echo -e "${YELLOW}huggingface-cli not found. Using wget (supports resume)${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: wget may be slower and require HuggingFace token for some files${NC}"
    echo ""

    URL="https://huggingface.co/unsloth/MiniMax-M2.1-GGUF/resolve/main/$MODEL_FILE"

    # Check if file exists on server
    if wget --spider -q "$URL"; then
        wget -c -O "$MODEL_FILE" "$URL" \
            --progress=bar:force \
            --show-progress

        echo ""
        echo -e "${GREEN}✅ Download complete via wget${NC}"
        exit 0
    else
        echo -e "${RED}❌ File not accessible via direct URL${NC}"
        echo "   This file may require authentication"
    fi
fi

# Method 3: curl (supports resume with -C -)
if command -v curl &> /dev/null; then
    echo -e "${YELLOW}wget not found. Using curl (supports resume)${NC}"
    echo ""

    URL="https://huggingface.co/unsloth/MiniMax-M2.1-GGUF/resolve/main/$MODEL_FILE"

    curl -L -C - -o "$MODEL_FILE" "$URL" \
        --progress-bar

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Download complete via curl${NC}"
        exit 0
    fi
fi

# No download tool available
echo ""
echo -e "${RED}❌ No suitable download tool found${NC}"
echo ""
echo "Please install one of the following:"
echo ""
echo "1. huggingface-cli (RECOMMENDED):"
echo "   pip install -U huggingface_hub"
echo ""
echo "2. wget:"
echo "   sudo apt install wget"
echo ""
echo "3. curl:"
echo "   sudo apt install curl"
echo ""
exit 1
