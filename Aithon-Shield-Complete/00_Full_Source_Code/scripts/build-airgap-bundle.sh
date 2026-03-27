#!/usr/bin/env bash
set -euo pipefail
# Aithon Shield — Air-Gap Bundle Builder (P6-I3)
#
# Usage (run while online):
#   chmod +x scripts/build-airgap-bundle.sh
#   ./scripts/build-airgap-bundle.sh
#
# Output: aithon-shield-airgap-<version>.tar.gz

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version" 2>/dev/null || echo "0.0.0")
BUNDLE_NAME="aithon-shield-airgap-${VERSION}"
BUNDLE_DIR="${ROOT_DIR}/${BUNDLE_NAME}"

echo "Aithon Shield Air-Gap Bundle Builder v${VERSION}"
echo ""

echo "Step 1/4: Building Docker images..."
cd "$ROOT_DIR"
docker compose build --no-cache
docker compose pull db 2>/dev/null || true
echo "  Done"

echo "Step 2/4: Exporting Docker images..."
mkdir -p "$BUNDLE_DIR"
docker save aithon-shield:latest postgres:16-alpine | gzip > "$BUNDLE_DIR/images.tar.gz"
echo "  Done"

echo "Step 3/4: Packaging deployment files..."
cp "$ROOT_DIR/docker-compose.yml" "$BUNDLE_DIR/"
cp "$ROOT_DIR/.env.example" "$BUNDLE_DIR/"
cp "$ROOT_DIR/Dockerfile" "$BUNDLE_DIR/"

cat > "$BUNDLE_DIR/README.md" << 'README'
# Aithon Shield Air-Gap Deployment

1. Load images: docker load < images.tar.gz
2. Configure: cp .env.example .env && edit .env
3. Start: docker compose up -d
4. Open: http://localhost:5001

Requirements: Docker 24+, 2 GB RAM, 10 GB disk
README
echo "  Done"

echo "Step 4/4: Creating archive..."
cd "$ROOT_DIR"
tar czf "${BUNDLE_NAME}.tar.gz" "$BUNDLE_NAME"
rm -rf "$BUNDLE_DIR"
echo "  Done: ${BUNDLE_NAME}.tar.gz"
