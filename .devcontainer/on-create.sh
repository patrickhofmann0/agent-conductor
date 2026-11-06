#!/usr/bin/env bash
# Installs the pinned toolchain into the devcontainer. Runs once on container creation.
set -euo pipefail

BUN_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"

echo "Installing bun ${BUN_VERSION}"
curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

echo "Installing opencode"
curl -fsSL https://opencode.ai/install | bash
