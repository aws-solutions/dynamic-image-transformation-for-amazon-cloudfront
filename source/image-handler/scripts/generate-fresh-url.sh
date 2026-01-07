#!/bin/bash

# Generate a fresh (cache-busted) URL for testing progressive AVIF loading
# Usage: ./generate-fresh-url.sh <cloudfront-url>
# Example: ./generate-fresh-url.sh 'https://d1234.cloudfront.net/eyJidWNrZXQ...'
#
# This script:
# 1. Decodes the base64 payload from the URL
# 2. Adds a unique nonce to bust the cache
# 3. Re-encodes and generates a new valid signature
# 4. Outputs the fresh URL ready for testing

set -e

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/config.sh" ]; then
    source "$SCRIPT_DIR/config.sh"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if signing secret is configured
if [ -z "$SIGNING_SECRET" ] || [ "$SIGNING_SECRET" = "YOUR_SIGNING_SECRET_HERE" ]; then
    echo -e "${RED}Error: SIGNING_SECRET not configured${NC}"
    echo "Please edit scripts/config.sh and set your signing secret"
    exit 1
fi

if [ -z "$1" ]; then
    echo -e "${CYAN}Generate Fresh URL for Progressive AVIF Testing${NC}"
    echo ""
    echo "Usage: $0 <cloudfront-url>"
    echo ""
    echo "Example:"
    echo "  $0 'https://d1234.cloudfront.net/eyJidWNrZXQ...?signature=abc123'"
    echo ""
    echo "This script generates a cache-busted URL with a valid signature"
    echo "for testing progressive AVIF loading with a fresh cache entry."
    exit 1
fi

ORIGINAL_URL="$1"

# Extract base URL (without query string)
ORIGINAL_BASE_URL="${ORIGINAL_URL%%\?*}"

# Extract domain
DOMAIN=$(echo "$ORIGINAL_BASE_URL" | sed -E 's|https?://([^/]+).*|\1|')

# Extract path (base64 payload)
ORIGINAL_PATH_PART=$(echo "$ORIGINAL_BASE_URL" | sed -E 's|https?://[^/]+/(.*)|\1|')

# Generate a unique nonce (timestamp + random)
if command -v md5sum &> /dev/null; then
    NONCE=$(echo "$(date +%s%N)$$" | md5sum | head -c 12)
else
    NONCE=$(echo "$(date +%s)$$" | md5 | head -c 12)
fi

echo -e "${BLUE}Original URL:${NC}"
echo "  Domain: $DOMAIN"
echo "  Path: ${ORIGINAL_PATH_PART:0:50}..."
echo ""

# Decode the payload
DECODED=$(echo "$ORIGINAL_PATH_PART" | base64 -d 2>/dev/null || echo "DECODE_FAILED")

if [ "$DECODED" = "DECODE_FAILED" ]; then
    echo -e "${RED}Error: Failed to decode base64 payload${NC}"
    echo "This might not be a DEFAULT request type (could be Thumbor or Custom)"
    exit 1
fi

echo -e "${BLUE}Original payload:${NC}"
echo "$DECODED" | python3 -m json.tool 2>/dev/null || echo "$DECODED"
echo ""

# Add cache-busting nonce to payload
DECODED_WITH_NONCE=$(echo "$DECODED" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data['_n'] = '$NONCE'
print(json.dumps(data, separators=(',', ':')))
" 2>/dev/null || echo "")

if [ -z "$DECODED_WITH_NONCE" ]; then
    echo -e "${RED}Error: Failed to modify payload${NC}"
    exit 1
fi

# Re-encode as base64
PATH_PART=$(echo -n "$DECODED_WITH_NONCE" | base64 | tr -d '\n')
NEW_PATH="/${PATH_PART}"

# Generate signature
NEW_SIGNATURE=$(echo -n "$NEW_PATH" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | sed 's/^.* //')

# Build final URL
FRESH_URL="https://${DOMAIN}${NEW_PATH}?signature=${NEW_SIGNATURE}"

echo -e "${GREEN}Fresh URL generated:${NC}"
echo ""
echo -e "${CYAN}$FRESH_URL${NC}"
echo ""
echo -e "${BLUE}Details:${NC}"
echo "  Nonce: $NONCE"
echo "  Signature: ${NEW_SIGNATURE:0:16}..."
echo ""
echo -e "${YELLOW}Tip:${NC} Copy the URL above to test with curl or the diagnostic script"
