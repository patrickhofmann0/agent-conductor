#!/usr/bin/env bash
# Installs the pinned toolchain into the devcontainer. Runs once on container creation.
set -euo pipefail

BUN_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
# Keep in sync with the @opencode/* packages conductor depends on (ADR 0012).
# The curl installer from opencode.ai still installs OpenCode V1, so use npm.
OPENCODE_VERSION="2.2.5"

# Named volumes (see devcontainer.json) are created owned by root. They keep the
# OpenCode login, OpenCode settings and the GitHub CLI login across rebuilds.
sudo mkdir -p "$HOME/.local/share"
sudo chown "$(id -u):$(id -g)" "$HOME/.local" "$HOME/.local/share"

for dir in \
  "$HOME/.local/share/opencode" \
  "$HOME/.config/opencode" \
  "$HOME/.local/state/opencode" \
  "$HOME/.config/gh"; do
  sudo mkdir -p "$dir"
  sudo chown -R "$(id -u):$(id -g)" "$dir"
done

echo "Installing bun ${BUN_VERSION}"
curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

echo "Installing opencode ${OPENCODE_VERSION}"
npm install --global "@opencode/cli@${OPENCODE_VERSION}"
opencode --version
