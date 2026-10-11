#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LABEL="jp.watanabeeita.social-trend-radar-sync"
USER_ID="$(id -u)"
DOMAIN="gui/${USER_ID}"
LAUNCH_AGENTS_DIR="${HOME:?HOME is required}/Library/LaunchAgents"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/SocialTrendRadar"
INTERVAL_SECONDS="${SYNC_INTERVAL_SECONDS:-3600}"

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

is_loaded() {
  launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1
}

build_stable_path() {
  local node_bin=""
  local pnpm_bin=""
  if command -v node >/dev/null 2>&1; then
    node_bin="$(dirname -- "$(command -v node)")"
  fi
  if command -v pnpm >/dev/null 2>&1; then
    pnpm_bin="$(dirname -- "$(command -v pnpm)")"
  fi

  local nvm_bin=""
  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    local latest_nvm
    latest_nvm="$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | tail -n 1 || true)"
    if [[ -n "${latest_nvm}" && -d "${HOME}/.nvm/versions/node/${latest_nvm}/bin" ]]; then
      nvm_bin="${HOME}/.nvm/versions/node/${latest_nvm}/bin"
    fi
  fi

  printf '%s:%s:%s:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
    "${node_bin}" "${pnpm_bin}" "${nvm_bin}"
}

write_plist() {
  local stable_path
  stable_path="$(build_stable_path)"

  mkdir -p "${LAUNCH_AGENTS_DIR}" "${LOG_DIR}"

  cat <<PLIST > "${PLIST_PATH}"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${PROJECT_DIR}/scripts/auto-sync-worker.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>${stable_path}</string>
    <key>AUTO_GIT_PUSH</key>
    <string>true</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/sync-worker.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/sync-worker.err.log</string>
</dict>
</plist>
PLIST

  chmod 600 "${PLIST_PATH}"
  plutil -lint "${PLIST_PATH}" >/dev/null
}

install_schedule() {
  log_info "定期同期タイマーサービスを登録します（間隔: ${INTERVAL_SECONDS}秒 / 1時間ごと）"
  write_plist

  if is_loaded; then
    launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
    sleep 1
  fi

  local attempt
  for attempt in {1..10}; do
    if launchctl bootstrap "${DOMAIN}" "${PLIST_PATH}"; then
      log_info "定期自動実行タイマーを正常に登録・起動しました: ${LABEL}"
      log_info "実行間隔: ${INTERVAL_SECONDS} 秒（1時間ごと）"
      log_info "実行ログ: ${LOG_DIR}/sync-worker.out.log"
      return 0
    fi
    log_error "タイマー起動待機中（${attempt}/10）..."
    sleep 1
  done

  log_error "タイマーの登録に失敗しました。cronへのフォールバックを推奨します。"
  return 1
}

uninstall_schedule() {
  if is_loaded; then
    launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
    log_info "定期タイマーを解除しました"
  else
    log_info "定期タイマーは登録されていません"
  fi
  if [[ -f "${PLIST_PATH}" ]]; then
    rm -f -- "${PLIST_PATH}"
    log_info "定義ファイルを削除しました: ${PLIST_PATH}"
  fi
}

status_schedule() {
  if is_loaded; then
    launchctl print "${DOMAIN}/${LABEL}"
    return 0
  fi
  log_error "定期タイマーサービスは登録されていません"
  return 1
}

run_now() {
  log_info "手動で即時同期サイクルを実行します..."
  bash "${PROJECT_DIR}/scripts/auto-sync-worker.sh"
}

usage() {
  printf 'Usage: %s {install|status|uninstall|run-now}\n' "${0##*/}"
}

case "${1:-}" in
  install)
    install_schedule
    ;;
  status)
    status_schedule
    ;;
  uninstall)
    uninstall_schedule
    ;;
  run-now)
    run_now
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
