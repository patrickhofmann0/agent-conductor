# Sourced by lefthook (see `rc` in lefthook.yml) before every hook command.
# Git hooks often run without the user's interactive shell config (GUI clients,
# fresh terminals), so bun may be installed but missing from PATH.
# POSIX sh: lefthook executes commands with sh.

if ! command -v bun >/dev/null 2>&1; then
  bun_bin="${BUN_INSTALL:-$HOME/.bun}/bin"
  if [ -x "$bun_bin/bun" ]; then
    PATH="$bun_bin:$PATH"
    export PATH
  fi
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found. Install the version from package.json#packageManager" >&2
  echo "(https://bun.sh), run 'source ~/.bashrc', or use the devcontainer." >&2
  exit 1
fi
