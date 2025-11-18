# Compliant Dockerfile using only approved Amazon ECR Public Gallery images
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS builder

WORKDIR /app

# Install Node.js 20
RUN dnf update -y && \
    dnf install -y nodejs npm && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Copy workspace configuration
COPY package.json package-lock.json* ./
COPY container/package.json ./container/
COPY data-models/package.json ./data-models/


# Install all workspace dependencies
RUN npm ci --workspaces --no-audit --no-fund --omit=optional && \
    npm cache clean --force

# Copy source files
COPY container/src/ ./container/src/
COPY container/tsconfig.json ./container/tsconfig.json
COPY data-models/ ./data-models/

# Build data-models first, then container
RUN npm run build --workspace=data-models && \
    npm run build --workspace=container

# Production dependencies stage
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS deps
WORKDIR /app

# Install Node.js 20
RUN dnf update -y && \
    dnf install -y nodejs npm && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Install production dependencies with workspace structure
COPY package.json package-lock.json* ./
COPY container/package.json ./container/
COPY data-models/ ./data-models/
RUN npm ci --workspaces --omit=dev --no-audit --no-fund && \
    npm rebuild sharp && \
    npm cache clean --force && \
    # Aggressive cleanup to reduce size
    find node_modules -name "*.md" -delete && \
    find node_modules -name "*.txt" -delete && \
    find node_modules -name "LICENSE*" -delete && \
    find node_modules -name "CHANGELOG*" -delete && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "*.map" -delete && \
    find node_modules -name "*.d.ts" -delete && \
    # Remove Sharp's unnecessary platform binaries for current architecture
    find node_modules/sharp -name "*.node" ! -path "*/$(node -p 'process.platform + "-" + process.arch')/*" -delete 2>/dev/null || true



# Final minimal stage
FROM public.ecr.aws/amazonlinux/amazonlinux:minimal
WORKDIR /app

# Install Node.js runtime and shadow-utils for user management
RUN dnf update -y && \
    dnf install -y nodejs shadow-utils && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown appuser:appuser /app

COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/data-models ./data-models
COPY --from=builder --chown=appuser:appuser /app/container/dist ./dist

USER appuser
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/container/src/server.js"]
