#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
RUNTIME_DIR="${TMPDIR:-/tmp}/social-trend-radar-${UID}"
PID_FILE="${RUNTIME_DIR}/stack.pid"
API_PID=""
BOT_PID=""
CRAWLER_PID=""

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

read_env_value() {
  local -r key="$1"
  awk -v wanted="${key}" '
    index($0, wanted "=") == 1 {
      value = substr($0, length(wanted) + 2)
      sub(/\r$/, "", value)
      print value
      exit
    }
  ' "${PROJECT_DIR}/.env"
}

cleanup() {
  local child_pid
  trap - EXIT INT TERM
  for child_pid in "${CRAWLER_PID}" "${BOT_PID}" "${API_PID}"; do
    if [[ -n "${child_pid}" ]] && kill -0 "${child_pid}" 2>/dev/null; then
      kill -TERM "${child_pid}" 2>/dev/null || true
    fi
  done
  for child_pid in "${CRAWLER_PID}" "${BOT_PID}" "${API_PID}"; do
    if [[ -n "${child_pid}" ]]; then
      wait "${child_pid}" 2>/dev/null || true
    fi
  done
  if [[ -f "${PID_FILE}" ]] && [[ "$(<"${PID_FILE}")" == "$$" ]]; then
    rm -f -- "${PID_FILE}"
  fi
}
trap cleanup EXIT INT TERM

main() {
  cd "${PROJECT_DIR}"
  [[ -f .env ]] || {
    log_error ".envがありません"
    return 1
  }
  command -v pnpm >/dev/null 2>&1 || {
    log_error "pnpmがありません"
    return 1
  }

  mkdir -p "${RUNTIME_DIR}"
  if [[ -f "${PID_FILE}" ]]; then
    local existing_pid
    existing_pid="$(<"${PID_FILE}")"
    if [[ "${existing_pid}" =~ ^[0-9]+$ ]] && kill -0 "${existing_pid}" 2>/dev/null; then
      log_error "ローカルスタックは既に起動しています（PID ${existing_pid}）"
      return 1
    fi
  fi
  printf '%s\n' "$$" > "${PID_FILE}"

  local host
  local port
  host="$(read_env_value HOST)"
  port="$(read_env_value PORT)"
  host="${host:-127.0.0.1}"
  port="${port:-8787}"

  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    log_error "TCP port ${port}は既に使用中です。二重起動を避けるため停止します。"
    return 1
  fi

  log_info "Capture APIを起動します"
  pnpm start &
  API_PID="$!"

  local attempt
  for attempt in $(seq 1 30); do
    if ! kill -0 "${API_PID}" 2>/dev/null; then
      log_error "Capture APIが起動直後に終了しました"
      return 1
    fi
    if curl --fail --silent --output /dev/null "http://${host}:${port}/health"; then
      break
    fi
    sleep 1
  done
  if ! curl --fail --silent --output /dev/null "http://${host}:${port}/health"; then
    log_error "Capture APIの応答を30秒以内に確認できませんでした"
    return 1
  fi

  log_info "Slack Botを起動します"
  pnpm bot &
  BOT_PID="$!"

  sleep 3
  if ! kill -0 "${BOT_PID}" 2>/dev/null; then
    log_error "Botが起動直後に終了しました"
    return 1
  fi

  local crawler_enabled
  crawler_enabled="$(read_env_value CRAWLER_ENABLED)"
  if [[ "${crawler_enabled}" == "true" ]]; then
    log_info "Instagram / TikTok閲覧専用Crawlerを起動します"
    pnpm crawler &
    CRAWLER_PID="$!"
    sleep 3
    if ! kill -0 "${CRAWLER_PID}" 2>/dev/null; then
      log_error "Crawlerが起動直後に終了しました。APIとBotは継続します。"
      CRAWLER_PID=""
    fi
  fi
  log_info "収集スタックが起動しました（API PID ${API_PID}, Bot PID ${BOT_PID}, Crawler PID ${CRAWLER_PID:-disabled}）"

  while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${BOT_PID}" 2>/dev/null; do
    if [[ -n "${CRAWLER_PID}" ]] && ! kill -0 "${CRAWLER_PID}" 2>/dev/null; then
      log_error "Crawlerが終了しました。APIとBotは継続します。"
      CRAWLER_PID=""
    fi
    sleep 5
  done

  if ! kill -0 "${API_PID}" 2>/dev/null; then
    log_error "Capture APIが終了したためスタックを停止します"
  else
    log_error "Botが終了したためスタックを停止します"
  fi
  return 1
}

main
