#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
DATABASE_PATH="${DATABASE_PATH:-${HOME:?HOME is required}/Library/Application Support/SocialTrendRadar/data/social-trend-radar.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
ARCHIVE_DIR="${BACKUP_DIR}/90_アーカイブ"
ACTIVE_GENERATIONS="${BACKUP_GENERATIONS:-14}"
LOCK_DIR="${TMPDIR:-/tmp}/social-trend-radar-backup-${UID}.lock"
TEMP_BACKUP=""

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

cleanup() {
  if [[ -n "${TEMP_BACKUP}" && -f "${TEMP_BACKUP}" ]]; then
    rm -f -- "${TEMP_BACKUP}"
  fi
  if [[ -d "${LOCK_DIR}" ]]; then
    rmdir "${LOCK_DIR}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

archive_overflow_generations() {
  local -a backups=()
  local overflow
  local index
  local source
  local destination

  while IFS= read -r backup; do
    backups+=("${backup}")
  done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'social-trend-radar-*.sqlite' -print | LC_ALL=C sort)

  overflow=$((${#backups[@]} - ACTIVE_GENERATIONS))
  if (( overflow <= 0 )); then
    return 0
  fi

  for ((index = 0; index < overflow; index += 1)); do
    source="${backups[index]}"
    destination="${ARCHIVE_DIR}/$(basename -- "${source}")"
    if [[ -e "${destination}" ]]; then
      log_error "退避先が既に存在します: ${destination}"
      return 1
    fi
    mv -- "${source}" "${destination}"
    log_info "古い世代を削除せずアーカイブしました: ${destination}"
  done
}

main() {
  command -v sqlite3 >/dev/null 2>&1 || {
    log_error "sqlite3がありません"
    return 1
  }
  [[ -f "${DATABASE_PATH}" ]] || {
    log_error "SQLite正本がありません: ${DATABASE_PATH}"
    return 1
  }
  [[ "${ACTIVE_GENERATIONS}" =~ ^[1-9][0-9]*$ ]] || {
    log_error "BACKUP_GENERATIONSは1以上の整数にしてください"
    return 1
  }
  [[ "${BACKUP_DIR}" != *"'"* ]] || {
    log_error "バックアップ先にシングルクォートは使用できません"
    return 1
  }

  if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
    log_error "別のバックアップ処理が実行中です"
    return 1
  fi

  mkdir -p "${BACKUP_DIR}" "${ARCHIVE_DIR}"
  local timestamp
  local final_backup
  local integrity_result
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  final_backup="${BACKUP_DIR}/social-trend-radar-${timestamp}.sqlite"
  TEMP_BACKUP="${BACKUP_DIR}/.social-trend-radar-${timestamp}.$$.tmp.sqlite"

  sqlite3 "${DATABASE_PATH}" ".timeout 10000" ".backup '${TEMP_BACKUP}'"
  integrity_result="$(sqlite3 "${TEMP_BACKUP}" 'PRAGMA integrity_check;')"
  [[ "${integrity_result}" == "ok" ]] || {
    log_error "バックアップのintegrity_checkに失敗しました"
    return 1
  }
  mv -- "${TEMP_BACKUP}" "${final_backup}"
  TEMP_BACKUP=""
  chmod 600 "${final_backup}"
  archive_overflow_generations
  log_info "SQLiteオンラインバックアップが完了しました: ${final_backup}"
}

main
