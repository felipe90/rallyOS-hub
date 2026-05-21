#!/usr/bin/env bash
# RallyOS Hub — ensure `pnpm` is on PATH for host-side scripts (dev.sh, start.sh).
# If missing, tries Corepack using the version from package.json "packageManager".

ensure_pnpm() {
  local repo_root="${1:?repo root required}"
  local pkg_json="$repo_root/package.json"
  local pnpm_ver

  if [ ! -f "$pkg_json" ]; then
    echo "ensure_pnpm: package.json not found at $repo_root" >&2
    return 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is not installed. Install Node 22+ (see README)." >&2
    return 1
  fi

  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    echo "ERROR: pnpm not found and Corepack is unavailable (use Node 16.13+)." >&2
    echo "       Install pnpm: https://pnpm.io/installation" >&2
    return 1
  fi

  pnpm_ver="$(
    node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const p = (j.packageManager || '').replace(/^pnpm@/, '');
console.log(p || '9.15.9');
" "$pkg_json" 2>/dev/null || echo "9.15.9"
  )"

  echo "pnpm not on PATH — activating via Corepack (pnpm@${pnpm_ver})..." >&2
  corepack enable >&2 || true
  if ! corepack prepare "pnpm@${pnpm_ver}" --activate >&2; then
    echo "ERROR: corepack prepare pnpm@${pnpm_ver} failed (network or version)." >&2
    return 1
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "ERROR: pnpm still not available after Corepack. Try: corepack prepare pnpm@${pnpm_ver} --activate" >&2
    return 1
  fi
  return 0
}
