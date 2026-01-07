#!/bin/bash

# Configuration for progressive AVIF loading test scripts
# This file is sourced by other scripts in this directory

# Signing secret for generating valid signatures
# Get this from AWS Secrets Manager or your deployment configuration
SIGNING_SECRET="3c1b40576c64f36f7fc14b11fccc9b31"

# CloudFront domain for the image handler
CLOUDFRONT_DOMAIN="d38hfxa2550ji4.cloudfront.net"

# Default Accept header (simulates browser request)
DEFAULT_ACCEPT_HEADER="image/avif,image/webp,image/*,*/*"
