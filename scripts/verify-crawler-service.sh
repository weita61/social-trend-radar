#!/usr/bin/env bash
set -Eeuo pipefail

LABEL="jp.watanabeeita.social-trend-radar"
DOMAIN="gui/$(id -u)"
RUNTIME_ROOT="${HOME:?HOME is required}/Library/Application Support/SocialTrendRadar"
DATABASE_PATH="${DATABASE_PATH:-${RUNTIME_ROOT}/data/social-trend-radar.sqlite}"
ERROR_LOG="${HOME}/Library/Logs/SocialTrendRadar/service.err.log"
WAIT_SECONDS="${CRAWLER_VERIFY_WAIT_SECONDS:-45}"

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

sql_scalar() {
  sqlite3 -batch -noheader "${DATABASE_PATH}" "$1"
}

show_recent_log() {
  if [[ -f "${ERROR_LOG}" ]]; then
    log_info "直近ログ（秘密値は出力しない実行ログ）"
    tail -n 40 "${ERROR_LOG}" >&2
  fi
}

main() {
  command -v launchctl >/dev/null 2>&1 || { log_error "launchctlがありません"; return 1; }
  command -v sqlite3 >/dev/null 2>&1 || { log_error "sqlite3がありません"; return 1; }
  command -v curl >/dev/null 2>&1 || { log_error "curlがありません"; return 1; }

  launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1 || {
    log_error "常駐サービスが起動していません"
    return 1
  }
  local api_ready=false
  for _ in $(seq 1 15); do
    if curl --fail --silent --output /dev/null http://127.0.0.1:8787/health; then
      api_ready=true
      break
    fi
    sleep 1
  done
  if [[ "${api_ready}" != "true" ]]; then
    log_error "Capture APIが応答しません"
    show_recent_log
    return 1
  fi
  [[ -f "${DATABASE_PATH}" ]] || {
    log_error "SQLite正本がありません: ${DATABASE_PATH}"
    return 1
  }

  local waited=0
  local instagram_runs=0
  while (( waited <= WAIT_SECONDS )); do
    instagram_runs="$(sql_scalar "
      SELECT COUNT(*)
      FROM automation_runs
      WHERE platform = 'instagram'
        AND status <> 'started'
        AND julianday(started_at) >= julianday('now', '-10 minutes');
    ")"
    if (( instagram_runs > 0 )); then
      break
    fi
    sleep 3
    waited=$((waited + 3))
  done

  if (( instagram_runs == 0 )); then
    log_error "${WAIT_SECONDS}秒待っても直近10分のInstagram巡回完了記録が作成されません"
    show_recent_log
    return 1
  fi

  local latest_run
  local executed_writes
  local tiktok_runs
  local auto_captures
  latest_run="$(sql_scalar "
    SELECT status || '|' || observed_count || '|' || saved_count || '|' || duplicate_count || '|' || COALESCE(error_code, '') || '|' || started_at
    FROM automation_runs
    WHERE platform = 'instagram' AND status <> 'started'
    ORDER BY started_at DESC
    LIMIT 1;
  ")"
  executed_writes="$(sql_scalar "SELECT COALESCE(SUM(executed_write), 0) FROM automation_audit_events;")"
  tiktok_runs="$(sql_scalar "SELECT COUNT(*) FROM automation_runs WHERE platform = 'tiktok';")"
  IFS='|' read -r status observed saved duplicates error_code started_at <<<"${latest_run}"
  auto_captures="$(sql_scalar "
    SELECT COUNT(*)
    FROM capture_events AS capture
    JOIN posts AS post ON post.id = capture.post_id
    WHERE capture.selection_method = 'auto_observed'
      AND post.platform = 'instagram'
      AND capture.captured_at >= '${started_at}';
  ")"

  printf 'service=running\n'
  printf 'capture_api=ok\n'
  printf 'instagram_latest_status=%s\n' "${status}"
  printf 'instagram_latest_observed=%s\n' "${observed}"
  printf 'instagram_latest_saved=%s\n' "${saved}"
  printf 'instagram_latest_duplicates=%s\n' "${duplicates}"
  printf 'instagram_latest_error=%s\n' "${error_code:-none}"
  printf 'instagram_auto_captures=%s\n' "${auto_captures}"
  printf 'tiktok_runs=%s\n' "${tiktok_runs}"
  printf 'executed_browser_writes=%s\n' "${executed_writes}"

  if [[ "${status}" == "failed" || "${status}" == "stopped" ]]; then
    log_error "Instagram最新巡回が${status}です: ${error_code:-unknown}"
    show_recent_log
    return 1
  fi
  [[ "${executed_writes}" == "0" ]] || {
    log_error "書き込み操作の実行記録が0件ではありません"
    return 1
  }
  [[ "${tiktok_runs}" == "0" ]] || {
    log_error "保留中のTikTok巡回記録が存在します"
    return 1
  }
  if [[ "${status}" == "succeeded" && "${auto_captures}" == "0" ]]; then
    log_error "巡回は成功しましたがInstagram投稿がまだ保存されていません"
    show_recent_log
    return 1
  fi

  log_info "Instagram閲覧専用巡回の受け入れ条件を確認しました"
}

main

