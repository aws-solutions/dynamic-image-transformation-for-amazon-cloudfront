#!/bin/bash

# Diagnostic script for progressive AVIF loading
# Usage: ./diagnose-progressive-loading.sh <cloudfront-url>
# Example: ./diagnose-progressive-loading.sh https://d1234abcd.cloudfront.net/eyJidWNrZXQ...

set -e

# Source configuration (for signing secret)
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

if [ -z "$1" ]; then
    echo -e "${RED}Error: No URL provided${NC}"
    echo "Usage: $0 <cloudfront-url> [signing-key]"
    echo "Example: $0 'https://d1234abcd.cloudfront.net/eyJidWNrZXQiOi...?signature=abc123'"
    echo "Example with key: $0 'https://...' 'my-secret-key'"
    echo ""
    echo "Tip: Configure SIGNING_SECRET in scripts/config.sh to avoid passing key each time"
    exit 1
fi

ORIGINAL_URL="$1"
# Use provided key, or fall back to config file secret
SIGNING_KEY="${2:-$SIGNING_SECRET}"

# Warn if no signing key available
if [ -z "$SIGNING_KEY" ] || [ "$SIGNING_KEY" = "YOUR_SIGNING_SECRET_HERE" ]; then
    echo -e "${YELLOW}Warning: No signing key configured${NC}"
    echo "  Cache-busted URLs will not have valid signatures."
    echo "  Configure SIGNING_SECRET in scripts/config.sh or pass key as second argument."
    echo ""
    SIGNING_KEY=""
fi

# Extract base URL and query string from original
ORIGINAL_BASE_URL="${ORIGINAL_URL%%\?*}"
QUERY_STRING=""
if [[ "$ORIGINAL_URL" == *"?"* ]]; then
    QUERY_STRING="?${ORIGINAL_URL#*\?}"
fi

# Extract domain
DOMAIN=$(echo "$ORIGINAL_BASE_URL" | sed -E 's|https?://([^/]+).*|\1|')

# Extract path (base64 payload)
ORIGINAL_PATH_PART=$(echo "$ORIGINAL_BASE_URL" | sed -E 's|https?://[^/]+/(.*)|\1|')

# Generate a random nonce for cache busting (compatible with macOS and Linux)
if command -v md5sum &> /dev/null; then
    NONCE=$(date +%s | md5sum | head -c 8)
else
    NONCE=$(date +%s | md5 | head -c 8)
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Progressive AVIF Loading Diagnostics${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${BLUE}URL Analysis:${NC}"
echo "  Domain: $DOMAIN"
echo "  Original Path: ${ORIGINAL_PATH_PART:0:50}..."
echo "  Query: $QUERY_STRING"
echo ""

# Try to decode the payload and add cache-busting nonce
echo -e "${BLUE}Payload Analysis:${NC}"
DECODED=$(echo "$ORIGINAL_PATH_PART" | base64 -d 2>/dev/null || echo "DECODE_FAILED")

if [ "$DECODED" = "DECODE_FAILED" ]; then
    echo -e "  ${RED}✗ Failed to decode base64 payload${NC}"
    echo "  This might not be a DEFAULT request type (could be Thumbor or Custom)"
    echo "  Using original URL without cache-busting nonce"
    URL="$ORIGINAL_URL"
    PATH_PART="$ORIGINAL_PATH_PART"
else
    echo "  Original payload:"
    echo "$DECODED" | python3 -m json.tool 2>/dev/null || echo "$DECODED"
    echo ""

    # Check for progressive loading indicators
    HAS_AVIF=$(echo "$DECODED" | grep -c '"avif"' || true)
    HAS_JPEG=$(echo "$DECODED" | grep -c '"jpeg"' || true)

    if [ "$HAS_AVIF" -gt 0 ] && [ "$HAS_JPEG" -gt 0 ]; then
        echo -e "  ${GREEN}✓ Has both avif and jpeg edits - Progressive loading ENABLED${NC}"
    elif [ "$HAS_AVIF" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ Has avif but no jpeg - Progressive loading DISABLED (no fallback)${NC}"
    elif [ "$HAS_JPEG" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ Has jpeg but no avif - Progressive loading DISABLED (no avif)${NC}"
    else
        echo -e "  ${YELLOW}⚠ No avif or jpeg edits - Progressive loading DISABLED${NC}"
    fi

    # Add cache-busting nonce to payload
    echo ""
    echo -e "${BLUE}Cache Busting:${NC}"
    echo "  Adding nonce: _test=$NONCE"

    # Use python3 to add the nonce to the JSON payload
    DECODED_WITH_NONCE=$(echo "$DECODED" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data['_test'] = '$NONCE'
print(json.dumps(data, separators=(',', ':')))
" 2>/dev/null || echo "")

    if [ -n "$DECODED_WITH_NONCE" ]; then
        # Re-encode as base64
        PATH_PART=$(echo -n "$DECODED_WITH_NONCE" | base64 | tr -d '\n')
        NEW_PATH="/${PATH_PART}"

        # Handle signature
        if [ -n "$SIGNING_KEY" ]; then
            # Generate new signature for modified payload
            NEW_SIGNATURE=$(echo -n "$NEW_PATH" | openssl dgst -sha256 -hmac "$SIGNING_KEY" | sed 's/^.* //')
            URL="https://${DOMAIN}${NEW_PATH}?signature=${NEW_SIGNATURE}"
            echo -e "  ${GREEN}✓ Generated new signature for cache-busted payload${NC}"
            echo "    Signature: ${NEW_SIGNATURE:0:16}..."
        elif [[ "$QUERY_STRING" == *"signature="* ]]; then
            echo -e "  ${YELLOW}⚠ Original URL has signature - removing it for cache-bust test${NC}"
            echo "    (Signature is invalid for modified payload)"
            echo "    If signature is REQUIRED, tests will fail with 403"
            echo "    TIP: Pass signing key as second argument to generate valid signature"
            URL="https://${DOMAIN}${NEW_PATH}"
        else
            URL="https://${DOMAIN}${NEW_PATH}${QUERY_STRING}"
        fi

        echo "  New payload: ${DECODED_WITH_NONCE:0:80}..."
        echo -e "  ${GREEN}✓ Using cache-busted URL for all tests${NC}"
    else
        echo -e "  ${YELLOW}⚠ Failed to add nonce, using original URL${NC}"
        URL="$ORIGINAL_URL"
        PATH_PART="$ORIGINAL_PATH_PART"
    fi
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Test 1: Initial Request (expecting 302 redirect)${NC}"
echo -e "${CYAN}========================================${NC}"

# Use browser-like Accept header for proper cache key matching
ACCEPT_HEADER="${DEFAULT_ACCEPT_HEADER:-image/avif,image/webp,image/*,*/*}"

echo "Sending request without x-bw-warm header..."
echo "  (Accept: $ACCEPT_HEADER)"
RESPONSE1=$(curl -s -w "\n%{http_code}\n%{content_type}\n%{redirect_url}" -H "Accept: $ACCEPT_HEADER" -o /tmp/response1.body -D /tmp/response1.headers "$URL" 2>&1)

HTTP_CODE1=$(tail -3 <<< "$RESPONSE1" | head -1)
CONTENT_TYPE1=$(tail -2 <<< "$RESPONSE1" | head -1)
REDIRECT_URL=$(tail -1 <<< "$RESPONSE1")

echo ""
echo "Response:"
echo "  HTTP Status: $HTTP_CODE1"
echo "  Content-Type: $CONTENT_TYPE1"

# Extract CloudFront headers for analysis
X_CACHE1=$(grep -i "^x-cache:" /tmp/response1.headers 2>/dev/null | tr -d '\r' || echo "")
X_AMZ_CF_POP1=$(grep -i "^x-amz-cf-pop:" /tmp/response1.headers 2>/dev/null | tr -d '\r' || echo "")
X_AMZ_CF_ID1=$(grep -i "^x-amz-cf-id:" /tmp/response1.headers 2>/dev/null | tr -d '\r' || echo "")
AGE1=$(grep -i "^age:" /tmp/response1.headers 2>/dev/null | tr -d '\r' || echo "")

echo "  $X_CACHE1"
[ -n "$AGE1" ] && echo "  $AGE1"
[ -n "$X_AMZ_CF_POP1" ] && echo "  $X_AMZ_CF_POP1"

if [ "$HTTP_CODE1" = "302" ]; then
    echo -e "  ${GREEN}✓ Got 302 redirect (progressive loading triggered)${NC}"

    LOCATION=$(grep -i "^location:" /tmp/response1.headers | sed 's/[Ll]ocation: //' | tr -d '\r')
    echo "  Location: ${LOCATION:0:100}..."

    CACHE_CONTROL=$(grep -i "^cache-control:" /tmp/response1.headers | sed 's/[Cc]ache-[Cc]ontrol: //' | tr -d '\r')
    echo "  Cache-Control: $CACHE_CONTROL"

    if [[ "$CACHE_CONTROL" == *"no-store"* ]]; then
        echo -e "  ${GREEN}✓ Cache-Control includes no-store (redirect not cached)${NC}"
    elif [[ "$CACHE_CONTROL" == *"max-age=1"* ]] || [[ "$CACHE_CONTROL" == *"max-age=3"* ]]; then
        echo -e "  ${GREEN}✓ Cache-Control has short TTL (redirect cached briefly)${NC}"
    else
        echo -e "  ${YELLOW}⚠ Unexpected Cache-Control value${NC}"
    fi

    # Decode the JPEG redirect URL payload
    echo ""
    echo "  Analyzing JPEG redirect URL..."
    JPEG_PATH=$(echo "$LOCATION" | sed -E 's|https?://[^/]+/([^?]*).*|\1|')
    JPEG_DECODED=$(echo "$JPEG_PATH" | base64 -d 2>/dev/null || echo "DECODE_FAILED")
    if [ "$JPEG_DECODED" != "DECODE_FAILED" ]; then
        echo "  JPEG payload:"
        echo "$JPEG_DECODED" | python3 -m json.tool 2>/dev/null | head -20

        JPEG_HAS_AVIF=$(echo "$JPEG_DECODED" | grep -c '"avif"' || true)
        if [ "$JPEG_HAS_AVIF" -eq 0 ]; then
            echo -e "  ${GREEN}✓ JPEG payload correctly excludes avif${NC}"
        else
            echo -e "  ${RED}✗ JPEG payload still contains avif (bug!)${NC}"
        fi
    fi

elif [ "$HTTP_CODE1" = "200" ]; then
    echo -e "  ${YELLOW}⚠ Got 200 OK (no redirect)${NC}"

    # Check if it's AVIF or JPEG
    if [[ "$CONTENT_TYPE1" == *"avif"* ]]; then
        echo -e "  ${BLUE}ℹ Content is AVIF${NC}"
        if [[ "$X_CACHE1" == *"Hit"* ]]; then
            echo -e "  ${GREEN}✓ AVIF served from CloudFront cache - warming worked previously!${NC}"
        else
            echo -e "  ${YELLOW}⚠ AVIF but cache miss - unexpected${NC}"
        fi
    elif [[ "$CONTENT_TYPE1" == *"jpeg"* ]] || [[ "$CONTENT_TYPE1" == *"jpg"* ]]; then
        echo -e "  ${BLUE}ℹ Content is JPEG${NC}"
    fi
else
    echo -e "  ${RED}✗ Got unexpected status code: $HTTP_CODE1${NC}"
    echo "  Response body:"
    cat /tmp/response1.body | head -20
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Test 2: Async Warming Verification (THE KEY TEST)${NC}"
echo -e "${CYAN}========================================${NC}"

echo "Waiting 5 seconds for Lambda's async warming to complete..."
echo "  (Test 1 triggered async Lambda self-invoke to warm cache)"
sleep 5

echo ""
echo "Sending SAME request as Test 1 (should now get cached AVIF from async warming)..."
RESPONSE2=$(curl -s -w "\n%{http_code}\n%{content_type}" -H "Accept: $ACCEPT_HEADER" -o /tmp/response2.body -D /tmp/response2.headers "$URL" 2>&1)

HTTP_CODE2=$(tail -2 <<< "$RESPONSE2" | head -1)
CONTENT_TYPE2=$(tail -1 <<< "$RESPONSE2")

echo ""
echo "Response:"
echo "  HTTP Status: $HTTP_CODE2"
echo "  Content-Type: $CONTENT_TYPE2"

X_CACHE2=$(grep -i "^x-cache:" /tmp/response2.headers 2>/dev/null | tr -d '\r' || echo "")
AGE2=$(grep -i "^age:" /tmp/response2.headers 2>/dev/null | tr -d '\r' || echo "")
X_AMZ_CF_POP2=$(grep -i "^x-amz-cf-pop:" /tmp/response2.headers 2>/dev/null | tr -d '\r' || echo "")

echo "  $X_CACHE2"
[ -n "$AGE2" ] && echo "  $AGE2"
[ -n "$X_AMZ_CF_POP2" ] && echo "  $X_AMZ_CF_POP2"

ASYNC_WARMING_WORKS=false
if [ "$HTTP_CODE2" = "200" ]; then
    FILE_SIZE2=$(wc -c < /tmp/response2.body | tr -d ' ')
    echo "  Response size: $FILE_SIZE2 bytes"

    if [[ "$CONTENT_TYPE2" == *"avif"* ]]; then
        if [[ "$X_CACHE2" == *"Hit"* ]]; then
            echo -e "  ${GREEN}✓ SUCCESS! Async warming worked - AVIF served from cache${NC}"
            ASYNC_WARMING_WORKS=true
        else
            echo -e "  ${YELLOW}⚠ Got AVIF but cache miss - async warming may have just completed${NC}"
        fi
    elif [[ "$CONTENT_TYPE2" == *"jpeg"* ]] || [[ "$CONTENT_TYPE2" == *"jpg"* ]]; then
        echo -e "  ${RED}✗ Got JPEG instead of AVIF${NC}"
    fi
elif [ "$HTTP_CODE2" = "302" ]; then
    echo -e "  ${RED}✗ Still getting 302 redirect - async warming did NOT work${NC}"
    echo ""
    echo "  Possible causes:"
    echo "  1. Lambda async self-invoke failed"
    echo "  2. Origin Shield not enabled (cache not shared between edges)"
    echo "  3. Accept header mismatch in cache key"
    echo "  4. Async warming took longer than 5 seconds"
else
    echo -e "  ${RED}✗ Got unexpected status code: $HTTP_CODE2${NC}"
    cat /tmp/response2.body | head -20
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Test 3: Explicit Warming Request (x-bw-warm: 1)${NC}"
echo -e "${CYAN}========================================${NC}"

echo "Sending warming request WITH x-bw-warm: 1 header..."
echo "  (This tests that x-bw-warm header is forwarded correctly)"
echo ""

RESPONSE3=$(curl -s -w "\n%{http_code}\n%{content_type}\n%{time_total}" -H "Accept: $ACCEPT_HEADER" -o /tmp/response3.body -D /tmp/response3.headers -H "x-bw-warm: 1" "$URL" 2>&1)

HTTP_CODE3=$(tail -3 <<< "$RESPONSE3" | head -1)
CONTENT_TYPE3=$(tail -2 <<< "$RESPONSE3" | head -1)
TIME_TOTAL=$(tail -1 <<< "$RESPONSE3")

echo "Response:"
echo "  HTTP Status: $HTTP_CODE3"
echo "  Content-Type: $CONTENT_TYPE3"
echo "  Time: ${TIME_TOTAL}s"

X_CACHE3=$(grep -i "^x-cache:" /tmp/response3.headers 2>/dev/null | tr -d '\r' || echo "")
AGE3=$(grep -i "^age:" /tmp/response3.headers 2>/dev/null | tr -d '\r' || echo "")
CACHE_CONTROL3=$(grep -i "^cache-control:" /tmp/response3.headers 2>/dev/null | sed 's/[Cc]ache-[Cc]ontrol: //' | tr -d '\r' || echo "")

echo "  $X_CACHE3"
[ -n "$AGE3" ] && echo "  $AGE3"
echo "  Cache-Control: $CACHE_CONTROL3"

if [ "$HTTP_CODE3" = "200" ]; then
    FILE_SIZE3=$(wc -c < /tmp/response3.body | tr -d ' ')
    echo "  Response size: $FILE_SIZE3 bytes"

    if [[ "$CONTENT_TYPE3" == *"avif"* ]]; then
        echo -e "  ${GREEN}✓ Got 200 with AVIF content${NC}"

        if [[ "$CACHE_CONTROL3" == *"max-age"* ]]; then
            MAX_AGE=$(echo "$CACHE_CONTROL3" | grep -oE 'max-age=[0-9]+' | cut -d= -f2)
            echo -e "  ${GREEN}✓ max-age=$MAX_AGE - CloudFront SHOULD cache this${NC}"
        else
            echo -e "  ${RED}✗ No max-age in Cache-Control - CloudFront may NOT cache!${NC}"
        fi

        if [[ "$X_CACHE3" == *"Miss"* ]]; then
            echo -e "  ${BLUE}ℹ Cache miss - AVIF was generated fresh${NC}"
        elif [[ "$X_CACHE3" == *"Hit"* ]]; then
            echo -e "  ${GREEN}✓ Cache hit - AVIF was already cached${NC}"
        fi
    elif [[ "$CONTENT_TYPE3" == *"jpeg"* ]] || [[ "$CONTENT_TYPE3" == *"jpg"* ]]; then
        echo -e "  ${RED}✗ Got JPEG instead of AVIF for warming request!${NC}"
        echo "  This means Lambda is not generating AVIF for warming requests"
    else
        echo -e "  ${YELLOW}⚠ Got unexpected content type: $CONTENT_TYPE3${NC}"
    fi
elif [ "$HTTP_CODE3" = "302" ]; then
    echo -e "  ${RED}✗ Got 302 redirect for warming request!${NC}"
    echo "  x-bw-warm header is NOT being forwarded to Lambda"
    echo ""
    echo "  Possible causes:"
    echo "  1. CloudFront Origin Request Policy doesn't include x-bw-warm header"
    echo "  2. Header is being stripped somewhere in the chain"

    LOCATION3=$(grep -i "^location:" /tmp/response3.headers | sed 's/[Ll]ocation: //' | tr -d '\r')
    echo "  Redirect Location: ${LOCATION3:0:100}..."
elif [ "$HTTP_CODE3" = "404" ]; then
    echo -e "  ${RED}✗ Got 404 - Source image not found${NC}"
    cat /tmp/response3.body | python3 -m json.tool 2>/dev/null || cat /tmp/response3.body
else
    echo -e "  ${RED}✗ Got unexpected status code: $HTTP_CODE3${NC}"
    cat /tmp/response3.body | head -20
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Test 4: Multiple Sequential Requests (cache behavior)${NC}"
echo -e "${CYAN}========================================${NC}"

echo "Making 5 sequential requests to observe caching pattern..."
echo ""
for i in 1 2 3 4 5; do
    CACHE_RESP=$(curl -s -H "Accept: $ACCEPT_HEADER" -D /tmp/cache_resp_headers.txt -o /tmp/cache_resp_body.txt "$URL" 2>&1)
    HTTP_STATUS=$(grep -E "^HTTP" /tmp/cache_resp_headers.txt | tail -1 | awk '{print $2}')
    CONTENT_TYPE_SEQ=$(grep -i "^content-type:" /tmp/cache_resp_headers.txt 2>/dev/null | sed 's/[Cc]ontent-[Tt]ype: //' | tr -d '\r' || echo "N/A")
    X_CACHE=$(grep -i "^x-cache:" /tmp/cache_resp_headers.txt 2>/dev/null | sed 's/[Xx]-[Cc]ache: //' | tr -d '\r' || echo "N/A")
    AGE=$(grep -i "^age:" /tmp/cache_resp_headers.txt 2>/dev/null | sed 's/[Aa]ge: //' | tr -d '\r' || echo "N/A")
    POP=$(grep -i "^x-amz-cf-pop:" /tmp/cache_resp_headers.txt 2>/dev/null | sed 's/[Xx]-[Aa]mz-[Cc]f-[Pp]op: //' | tr -d '\r' || echo "N/A")

    # Determine content type short form
    if [[ "$CONTENT_TYPE_SEQ" == *"avif"* ]]; then
        CT_SHORT="AVIF"
    elif [[ "$CONTENT_TYPE_SEQ" == *"jpeg"* ]] || [[ "$CONTENT_TYPE_SEQ" == *"jpg"* ]]; then
        CT_SHORT="JPEG"
    else
        CT_SHORT="${CONTENT_TYPE_SEQ:0:20}"
    fi

    printf "  Request %d: Status=%-3s Content=%-4s Cache=%-20s Age=%-4s POP=%s\n" "$i" "$HTTP_STATUS" "$CT_SHORT" "$X_CACHE" "$AGE" "$POP"

    sleep 0.5
done

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Test 5: Direct Warming Request Cache Check${NC}"
echo -e "${CYAN}========================================${NC}"

echo "Verifying warming requests and normal requests share cache key..."
echo ""

echo "Request A: With x-bw-warm header"
RESP_A=$(curl -s -H "Accept: $ACCEPT_HEADER" -D /tmp/resp_a_headers.txt -o /tmp/resp_a_body.txt -H "x-bw-warm: 1" "$URL" 2>&1)
STATUS_A=$(grep -E "^HTTP" /tmp/resp_a_headers.txt | tail -1 | awk '{print $2}')
XCACHE_A=$(grep -i "^x-cache:" /tmp/resp_a_headers.txt 2>/dev/null | sed 's/[Xx]-[Cc]ache: //' | tr -d '\r' || echo "N/A")
CT_A=$(grep -i "^content-type:" /tmp/resp_a_headers.txt 2>/dev/null | sed 's/[Cc]ontent-[Tt]ype: //' | tr -d '\r' || echo "N/A")
echo "  Status: $STATUS_A, Cache: $XCACHE_A, Content-Type: $CT_A"

echo ""
echo "Request B: Without x-bw-warm header (immediately after)"
RESP_B=$(curl -s -H "Accept: $ACCEPT_HEADER" -D /tmp/resp_b_headers.txt -o /tmp/resp_b_body.txt "$URL" 2>&1)
STATUS_B=$(grep -E "^HTTP" /tmp/resp_b_headers.txt | tail -1 | awk '{print $2}')
XCACHE_B=$(grep -i "^x-cache:" /tmp/resp_b_headers.txt 2>/dev/null | sed 's/[Xx]-[Cc]ache: //' | tr -d '\r' || echo "N/A")
CT_B=$(grep -i "^content-type:" /tmp/resp_b_headers.txt 2>/dev/null | sed 's/[Cc]ontent-[Tt]ype: //' | tr -d '\r' || echo "N/A")
echo "  Status: $STATUS_B, Cache: $XCACHE_B, Content-Type: $CT_B"

echo ""
if [ "$STATUS_A" = "200" ] && [ "$STATUS_B" = "200" ]; then
    if [[ "$XCACHE_A" == *"Miss"* ]] && [[ "$XCACHE_B" == *"Hit"* ]]; then
        echo -e "${GREEN}✓ Cache key is CORRECT!${NC}"
        echo "  Warming request (Miss) populated cache, normal request (Hit) used it"
    elif [[ "$XCACHE_A" == *"Hit"* ]] && [[ "$XCACHE_B" == *"Hit"* ]]; then
        echo -e "${GREEN}✓ Both requests hit cache (already warmed)${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected cache pattern: A=$XCACHE_A, B=$XCACHE_B${NC}"
    fi
elif [ "$STATUS_A" = "200" ] && [ "$STATUS_B" = "302" ]; then
    echo -e "${RED}✗ CACHE KEY MISMATCH!${NC}"
    echo "  Warming request (200) and normal request (302) have DIFFERENT cache keys"
    echo ""
    echo "  This happens when x-bw-warm header is in the CACHE POLICY"
    echo "  x-bw-warm should ONLY be in ORIGIN REQUEST POLICY"
    echo ""
    echo "  Fix: Update CloudFront Cache Policy to REMOVE x-bw-warm from cache key"
elif [ "$STATUS_A" = "302" ]; then
    echo -e "${RED}✗ Warming request got 302!${NC}"
    echo "  x-bw-warm header is NOT reaching Lambda"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${CYAN}========================================${NC}"

echo ""
# Test 1: Initial request should get 302
# Test 2: Async warming verification - should get 200 AVIF from cache (THE KEY TEST)
# Test 3: Explicit warming with x-bw-warm header
if [ "$HTTP_CODE1" = "302" ] && [ "$HTTP_CODE2" = "200" ] && [[ "$CONTENT_TYPE2" == *"avif"* ]]; then
    if [[ "$X_CACHE2" == *"Hit"* ]]; then
        echo -e "${GREEN}✓ Progressive loading is FULLY WORKING!${NC}"
        echo "  1. Initial request gets 302 redirect to JPEG (fast response)"
        echo "  2. Lambda async warming populates cache in background"
        echo "  3. Subsequent requests get cached AVIF"
    else
        echo -e "${YELLOW}⚠ Progressive loading works but cache timing is slow${NC}"
        echo "  Async warming completed but wasn't cached in time"
        echo "  Try increasing the wait time or check Origin Shield config"
    fi
elif [ "$HTTP_CODE1" = "302" ] && [ "$HTTP_CODE2" = "302" ] && [ "$HTTP_CODE3" = "200" ]; then
    echo -e "${YELLOW}⚠ ASYNC WARMING NOT WORKING - but manual warming works${NC}"
    echo "  Test 2 (async verification): Still got 302 after 5 seconds"
    echo "  Test 3 (manual x-bw-warm): Successfully generated AVIF"
    echo ""
    echo "  Possible causes:"
    echo "  1. Origin Shield not enabled (edges don't share cache)"
    echo "  2. Lambda async self-invoke failing"
    echo "  3. Accept header mismatch in cache key"
    echo "  4. Async warming taking longer than 5 seconds"
elif [ "$HTTP_CODE1" = "302" ] && [ "$HTTP_CODE2" = "302" ] && [ "$HTTP_CODE3" = "302" ]; then
    echo -e "${RED}✗ WARMING COMPLETELY BROKEN!${NC}"
    echo "  Even explicit x-bw-warm requests get 302 redirect"
    echo "  x-bw-warm header is NOT reaching Lambda"
    echo ""
    echo "  Fix: Add x-bw-warm to CloudFront Origin Request Policy"
elif [ "$HTTP_CODE1" = "200" ] && [[ "$CONTENT_TYPE1" == *"avif"* ]]; then
    echo -e "${GREEN}✓ AVIF is already cached - system working!${NC}"
elif [ "$HTTP_CODE1" = "404" ] || [ "$HTTP_CODE2" = "404" ] || [ "$HTTP_CODE3" = "404" ]; then
    echo -e "${RED}✗ Source image not found${NC}"
    echo "  The image key doesn't exist in S3/EFS"
else
    echo -e "${RED}✗ Unexpected behavior - check logs for details${NC}"
    echo "  Test 1 (initial request): $HTTP_CODE1"
    echo "  Test 2 (async warming check): $HTTP_CODE2 $CONTENT_TYPE2"
    echo "  Test 3 (explicit x-bw-warm): $HTTP_CODE3"
fi

# Cleanup
rm -f /tmp/response1.body /tmp/response1.headers /tmp/response2.body /tmp/response2.headers /tmp/response3.body /tmp/response3.headers
rm -f /tmp/cache_resp_headers.txt /tmp/cache_resp_body.txt /tmp/resp_a_headers.txt /tmp/resp_a_body.txt /tmp/resp_b_headers.txt /tmp/resp_b_body.txt

echo ""
