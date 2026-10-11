#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

cd "${PROJECT_DIR}"

# Ensure standard Node, pnpm, and Homebrew paths are in PATH
if ! command -v node >/dev/null 2>&1; then
  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    LATEST_NVM="$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | tail -n 1 || true)"
    if [[ -n "${LATEST_NVM}" && -d "${HOME}/.nvm/versions/node/${LATEST_NVM}/bin" ]]; then
      export PATH="${HOME}/.nvm/versions/node/${LATEST_NVM}/bin:${PATH:-}"
    fi
  fi
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env 2>/dev/null || true
  set +a
fi

log_info "=== [AutoSyncWorker] Starting automated cycle ==="

# Step 1: Run crash-protected analysis
log_info "Step 1/3: Running resilient analysis pipeline..."
if node --env-file-if-exists=.env --experimental-strip-types src/cli/analyze.ts; then
  log_info "Analysis completed successfully."
else
  log_error "Analysis failed. Skipping sync to prevent corrupt state."
  exit 1
fi

# Step 2: Push snapshot to Vercel API
log_info "Step 2/3: Pushing snapshot to Vercel endpoint..."
if [[ -n "${SYNC_SECRET:-}" ]]; then
  if node --env-file-if-exists=.env --experimental-strip-types src/cli/syncSnapshot.ts; then
    log_info "Vercel HTTP sync succeeded."
  else
    log_error "Vercel HTTP sync failed."
  fi
else
  log_info "SYNC_SECRET is not set in .env. Skipping direct HTTP sync."
fi

# Step 3: Git auto-commit & push (zero manual push dependency)
log_info "Step 3/3: Checking for snapshot file changes for Git push..."
if [[ "${AUTO_GIT_PUSH:-true}" == "true" ]]; then
  if git status --porcelain src/data/ | grep -q 'src/data/'; then
    log_info "Snapshot changes detected. Committing and pushing to origin main..."
    git add src/data/seedSnapshot.ts src/data/seedSnapshot.json
    git commit -m "chore(data): auto sync snapshot from MacBook Air [$(date '+%Y-%m-%d %H:%M')]"
    if git push origin main; then
      log_info "Automated git push succeeded. Vercel deployment triggered automatically."
    else
      log_error "Git push failed. Please verify SSH key setup on MacBook Air."
    fi
  else
    log_info "No snapshot changes to commit."
  fi
fi

log_info "=== [AutoSyncWorker] Cycle finished successfully ==="
