#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LABEL="jp.watanabeeita.social-trend-radar"
USER_ID="$(id -u)"
DOMAIN="gui/${USER_ID}"
LAUNCH_AGENTS_DIR="${HOME:?HOME is required}/Library/LaunchAgents"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/SocialTrendRadar"
RUNTIME_ROOT="${HOME}/Library/Application Support/SocialTrendRadar"
RUNTIME_RELEASES_DIR="${RUNTIME_ROOT}/releases"
RUNTIME_CURRENT_LINK="${RUNTIME_ROOT}/current"
RUNTIME_DATA_DIR="${RUNTIME_ROOT}/data"
RUNTIME_DATABASE_PATH="${RUNTIME_DATA_DIR}/social-trend-radar.sqlite"
ROLLBACK_DIR="${RUNTIME_ROOT}/rollback"
TMP_PLIST=""
STAGED_RELEASE_DIR=""
FINAL_RELEASE_DIR=""
PREVIOUS_CURRENT_TARGET=""

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

cleanup_temp() {
  if [[ -n "${TMP_PLIST}" && -f "${TMP_PLIST}" ]]; then
    rm -f -- "${TMP_PLIST}"
  fi
  if [[ -n "${STAGED_RELEASE_DIR}" && -d "${STAGED_RELEASE_DIR}" ]]; then
    log_error "失敗したステージングを調査用に保持します: ${STAGED_RELEASE_DIR}"
  fi
}
trap cleanup_temp EXIT

is_loaded() {
  launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1
}

require_macbook_air() {
  local model_name
  model_name="$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Model Name/ { print $2; exit }')"
  if [[ "${model_name}" != *"MacBook Air"* ]]; then
    log_error "常駐サービスはMacBook Airだけに導入します。現在: ${model_name:-判定不能}"
    return 1
  fi
}

write_plist() {
  local node_bin_dir
  local pnpm_bin_dir
  local plist_release_dir
  local stable_path
  node_bin_dir="$(dirname -- "$(command -v node)")"
  pnpm_bin_dir="$(dirname -- "$(command -v pnpm)")"
  plist_release_dir="${FINAL_RELEASE_DIR:-${RUNTIME_CURRENT_LINK}}"
  stable_path="${node_bin_dir}:${pnpm_bin_dir}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

  TMP_PLIST="$(mktemp "${TMPDIR:-/tmp}/${LABEL}.XXXXXX")"
  PLIST_OUTPUT_PATH="${TMP_PLIST}" \
  PLIST_LABEL="${LABEL}" \
  PLIST_PROJECT_DIR="${plist_release_dir}" \
  PLIST_RUN_SCRIPT="${plist_release_dir}/scripts/run-local-stack.sh" \
  PLIST_STDOUT="${LOG_DIR}/service.out.log" \
  PLIST_STDERR="${LOG_DIR}/service.err.log" \
  PLIST_PATH_VALUE="${stable_path}" \
  PLIST_HOME_VALUE="${HOME}" \
  PLIST_DATABASE_PATH="${RUNTIME_DATABASE_PATH}" \
  node --input-type=module <<'NODE'
import { writeFileSync } from 'node:fs';

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const value = (name) => escapeXml(process.env[name] ?? '');
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${value('PLIST_LABEL')}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${value('PLIST_RUN_SCRIPT')}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${value('PLIST_PROJECT_DIR')}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${value('PLIST_HOME_VALUE')}</string>
    <key>PATH</key>
    <string>${value('PLIST_PATH_VALUE')}</string>
    <key>DATABASE_PATH</key>
    <string>${value('PLIST_DATABASE_PATH')}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${value('PLIST_STDOUT')}</string>
  <key>StandardErrorPath</key>
  <string>${value('PLIST_STDERR')}</string>
</dict>
</plist>
`;
writeFileSync(process.env.PLIST_OUTPUT_PATH, plist, { mode: 0o600 });
NODE
  plutil -lint "${TMP_PLIST}" >/dev/null
}

stage_release() {
  command -v rsync >/dev/null 2>&1 || {
    log_error "rsyncがありません"
    return 1
  }

  local release_id
  release_id="$(date '+%Y%m%d-%H%M%S')-$$"
  STAGED_RELEASE_DIR="${RUNTIME_RELEASES_DIR}/.staging-${release_id}"
  FINAL_RELEASE_DIR="${RUNTIME_RELEASES_DIR}/${release_id}"
  [[ ! -e "${STAGED_RELEASE_DIR}" && ! -e "${FINAL_RELEASE_DIR}" ]] || {
    log_error "同名のリリースが既に存在します: ${release_id}"
    return 1
  }

  mkdir -p "${STAGED_RELEASE_DIR}"
  /usr/bin/rsync -a \
    --exclude '.env' \
    --exclude '.git/' \
    --exclude 'backups/' \
    --exclude 'data/' \
    --exclude 'node_modules' \
    --exclude 'node_modules_stale_*/' \
    "${PROJECT_DIR}/" "${STAGED_RELEASE_DIR}/"
  cp -p "${PROJECT_DIR}/.env" "${STAGED_RELEASE_DIR}/.env"
  chmod 600 "${STAGED_RELEASE_DIR}/.env"

  log_info "ステージング先へ本番依存を導入します: ${STAGED_RELEASE_DIR}"
  (
    cd "${STAGED_RELEASE_DIR}"
    pnpm install --frozen-lockfile --prod
    bash -n scripts/run-local-stack.sh scripts/backup-database.sh
  )
  mv "${STAGED_RELEASE_DIR}" "${FINAL_RELEASE_DIR}"
  STAGED_RELEASE_DIR=""
  log_info "常駐リリースのステージングが完了しました: ${FINAL_RELEASE_DIR}"
}

switch_current_release() {
  local next_link
  next_link="${RUNTIME_ROOT}/.current.next.$$"
  if [[ -L "${RUNTIME_CURRENT_LINK}" ]]; then
    PREVIOUS_CURRENT_TARGET="$(readlink "${RUNTIME_CURRENT_LINK}")"
  elif [[ -e "${RUNTIME_CURRENT_LINK}" ]]; then
    log_error "currentがシンボリックリンクではありません: ${RUNTIME_CURRENT_LINK}"
    return 1
  fi

  ln -s "${FINAL_RELEASE_DIR}" "${next_link}"
  mv -fh "${next_link}" "${RUNTIME_CURRENT_LINK}"
  log_info "currentを原子的に切り替えました: ${FINAL_RELEASE_DIR}"
}

bootstrap_service_with_retry() {
  local attempt
  for attempt in {1..15}; do
    if launchctl bootstrap "${DOMAIN}" "${PLIST_PATH}"; then
      return 0
    fi
    log_error "launchd起動に失敗しました（${attempt}/15）。1秒後に再試行します"
    sleep 1
  done
  return 1
}

restore_previous_service() {
  local -r saved_plist="$1"
  if [[ -n "${PREVIOUS_CURRENT_TARGET}" ]]; then
    local rollback_link
    rollback_link="${RUNTIME_ROOT}/.current.rollback.$$"
    ln -s "${PREVIOUS_CURRENT_TARGET}" "${rollback_link}"
    mv -fh "${rollback_link}" "${RUNTIME_CURRENT_LINK}"
  fi

  if [[ -f "${saved_plist}" ]]; then
    cp -p "${saved_plist}" "${PLIST_PATH}"
    chmod 600 "${PLIST_PATH}"
    bootstrap_service_with_retry || true
  fi
  log_error "新リリースの起動に失敗したため、直前のサービス定義へ戻しました"
}

install_service() {
  require_macbook_air
  [[ -f "${PROJECT_DIR}/.env" ]] || {
    log_error ".envがありません。先にpnpm setup:macbook-airを実行してください。"
    return 1
  }
  command -v node >/dev/null 2>&1 || {
    log_error "nodeがありません"
    return 1
  }
  command -v pnpm >/dev/null 2>&1 || {
    log_error "pnpmがありません"
    return 1
  }

  mkdir -p "${LAUNCH_AGENTS_DIR}" "${LOG_DIR}" "${RUNTIME_ROOT}" "${RUNTIME_RELEASES_DIR}" "${RUNTIME_DATA_DIR}" "${ROLLBACK_DIR}"
  stage_release
  write_plist
  local saved_plist
  saved_plist="${ROLLBACK_DIR}/${LABEL}-$(date '+%Y%m%d-%H%M%S').plist"
  if [[ -f "${PLIST_PATH}" ]]; then
    cp -p "${PLIST_PATH}" "${saved_plist}"
  fi
  switch_current_release
  if is_loaded; then
    launchctl bootout "${DOMAIN}/${LABEL}"
  fi
  mv "${TMP_PLIST}" "${PLIST_PATH}"
  TMP_PLIST=""
  chmod 600 "${PLIST_PATH}"
  if ! bootstrap_service_with_retry; then
    restore_previous_service "${saved_plist}"
    return 1
  fi
  log_info "常駐サービスを導入・起動しました: ${LABEL}"
  log_info "稼働リリース: ${FINAL_RELEASE_DIR}"
  log_info "ログ: ${LOG_DIR}"
}

start_service() {
  require_macbook_air
  [[ -f "${PLIST_PATH}" ]] || {
    log_error "サービス定義がありません。先にinstallを実行してください。"
    return 1
  }
  if is_loaded; then
    log_info "サービスは既に起動しています"
    return 0
  fi
  launchctl bootstrap "${DOMAIN}" "${PLIST_PATH}"
  log_info "サービスを起動しました"
}

stop_service() {
  if ! is_loaded; then
    log_info "サービスは停止済みです"
    return 0
  fi
  launchctl bootout "${DOMAIN}/${LABEL}"
  log_info "サービスを停止しました（定義ファイルは保持）"
}

status_service() {
  if is_loaded; then
    launchctl print "${DOMAIN}/${LABEL}"
    return 0
  fi
  log_error "サービスは起動していません"
  return 1
}

validate_service() {
  command -v node >/dev/null 2>&1 || {
    log_error "nodeがありません"
    return 1
  }
  write_plist
  log_info "launchd定義の生成と形式検査に成功しました"
}

usage() {
  printf 'Usage: %s {install|start|stop|restart|status|validate}\n' "${0##*/}"
}

case "${1:-}" in
  install)
    install_service
    ;;
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service
    ;;
  status)
    status_service
    ;;
  validate)
    validate_service
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
