#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LOG_DIR="${PROJECT_DIR}/logs"
PID_FILE="${LOG_DIR}/pipeline-daemon.pid"
LOG_FILE="${LOG_DIR}/pipeline.log"
INTERVAL_MINUTES="${PIPELINE_INTERVAL_MINUTES:-30}"

mkdir -p "${LOG_DIR}"

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}" >&2
}

is_running() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

run_loop() {
  log_info "=== [PipelineDaemon] 常駐自動パイプラインを開始します (間隔: ${INTERVAL_MINUTES}分) ==="
  echo "$$" > "${PID_FILE}"

  cleanup() {
    log_info "=== [PipelineDaemon] 停止シグナル受信、終了します ==="
    rm -f "${PID_FILE}"
    exit 0
  }
  trap cleanup SIGINT SIGTERM

  cd "${PROJECT_DIR}"
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

  while true; do
    log_info "--- [Cycle] 収集〜台本生成〜分析〜スナップショット同期を開始 ---"
    if node --env-file-if-exists=.env --experimental-strip-types src/cli/runPipeline.ts >> "${LOG_FILE}" 2>&1; then
      log_info "--- [Cycle] 完了。次回実行は ${INTERVAL_MINUTES}分後 です ---"
    else
      log_error "--- [Cycle] エラーが発生しましたが次回サイクルまで待機します ---"
    fi
    sleep "$((INTERVAL_MINUTES * 60))"
  done
}

start_daemon() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    log_info "パイプラインデーモンは既に稼働中です (PID: ${pid})"
    return 0
  fi

  log_info "バックグラウンドでパイプラインデーモンを起動します..."
  nohup bash "${BASH_SOURCE[0]}" run >> "${LOG_FILE}" 2>&1 &
  local new_pid="$!"
  echo "${new_pid}" > "${PID_FILE}"
  sleep 1

  if kill -0 "${new_pid}" 2>/dev/null; then
    log_info "正常にバックグラウンド起動しました (PID: ${new_pid}, ログ: ${LOG_FILE})"
  else
    log_error "起動に失敗しました。ログを確認してください: ${LOG_FILE}"
    return 1
  fi
}

stop_daemon() {
  if ! is_running; then
    log_info "パイプラインデーモンは稼働していません"
    rm -f "${PID_FILE}"
    return 0
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  log_info "パイプラインデーモン (PID: ${pid}) を停止します..."
  kill -TERM "${pid}" 2>/dev/null || true
  sleep 1

  if kill -0 "${pid}" 2>/dev/null; then
    kill -KILL "${pid}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
  log_info "停止完了しました"
}

status_daemon() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "● 稼働中 (PID: ${pid})"
    echo "  実行ログ: ${LOG_FILE}"
    echo "  直近のログ:"
    tail -n 10 "${LOG_FILE}" 2>/dev/null || true
  else
    echo "○ 停止中"
  fi
}

case "${1:-status}" in
  run)
    run_loop
    ;;
  start)
    start_daemon
    ;;
  stop)
    stop_daemon
    ;;
  restart)
    stop_daemon
    start_daemon
    ;;
  status)
    status_daemon
    ;;
  *)
    echo "使用法: $0 {start|stop|restart|status|run}"
    exit 1
    ;;
esac
