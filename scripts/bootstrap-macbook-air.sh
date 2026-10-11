#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LOCAL_DEPENDENCY_ROOT="${HOME:?HOME is required}/Library/Application Support/SocialTrendRadar/dependencies/development"
EXTERNAL_NODE_MODULES="${LOCAL_DEPENDENCY_ROOT}/node_modules"
PROJECT_NODE_MODULES="${PROJECT_DIR}/node_modules"
CHECK_ONLY=false

log_info() {
  printf '[%s] INFO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_warn() {
  printf '[%s] WARN: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

on_error() {
  local -r exit_code="$?"
  log_error "環境構築に失敗しました（line ${BASH_LINENO[0]}, exit ${exit_code}）"
  exit "${exit_code}"
}
trap on_error ERR

usage() {
  printf 'Usage: %s [--check-only]\n' "${0##*/}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "不明なオプションです: $1"
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  local -r command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    log_error "必要なコマンドがありません: ${command_name}"
    return 1
  fi
}

read_env_value() {
  local -r key="$1"
  awk -v wanted="${key}" '
    index($0, wanted "=") == 1 {
      value = substr($0, length(wanted) + 2)
      sub(/\r$/, "", value)
      if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
      exit
    }
  ' "${PROJECT_DIR}/.env"
}

require_secret() {
  local -r key="$1"
  local -r minimum_length="$2"
  local value
  value="$(read_env_value "${key}")"
  if [[ ${#value} -lt ${minimum_length} ]]; then
    log_error ".envの${key}が未設定または短すぎます（秘密値は表示しません）"
    return 1
  fi
  log_info ".envの${key}を確認しました（値は非表示）"
}

validate_environment_file() {
  if [[ ! -f "${PROJECT_DIR}/.env" ]]; then
    log_error ".envがありません。同期状態を確認してください。自動生成はしません。"
    return 1
  fi

  if command -v git >/dev/null 2>&1 && ! git -C "${PROJECT_DIR}" check-ignore -q .env; then
    log_error ".envがGit除外されていません。処理を停止します。"
    return 1
  fi

  require_secret SUBMITTER_HASH_SECRET 32
  require_secret SLACK_BOT_TOKEN 20
  require_secret SLACK_APP_TOKEN 20
  require_secret YOUTUBE_API_KEY 20

  local slack_bot_token
  local slack_app_token
  slack_bot_token="$(read_env_value SLACK_BOT_TOKEN)"
  slack_app_token="$(read_env_value SLACK_APP_TOKEN)"
  [[ "${slack_bot_token}" == xoxb-* ]] || {
    log_error "SLACK_BOT_TOKENの形式が不正です（値は表示しません）"
    return 1
  }
  [[ "${slack_app_token}" == xapp-* ]] || {
    log_error "SLACK_APP_TOKENの形式が不正です（値は表示しません）"
    return 1
  }
}

validate_node_version() {
  node -e '
    const current = process.versions.node.split(".").map(Number);
    const minimum = [22, 13, 0];
    const valid = current.some((part, index) => part > minimum[index] && current.slice(0, index).every((v, i) => v === minimum[i]))
      || current.every((part, index) => part === minimum[index]);
    if (!valid) {
      console.error(`Node.js 22.13.0以上が必要です。現在: ${process.versions.node}`);
      process.exit(1);
    }
  '
  log_info "Node.js $(node --version)を確認しました"
}

validate_pnpm_version() {
  local pnpm_version
  pnpm_version="$(pnpm --version)"
  [[ "${pnpm_version}" == 11.* ]] || {
    log_error "pnpm 11系が必要です。現在: ${pnpm_version}"
    return 1
  }
  log_info "pnpm ${pnpm_version}を確認しました"
}

validate_machine() {
  [[ "$(uname -s)" == "Darwin" ]] || {
    log_error "macOS専用の環境構築スクリプトです"
    return 1
  }

  local model_name
  model_name="$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Model Name/ { print $2; exit }')"
  if [[ "${model_name}" == *"MacBook Air"* ]]; then
    log_info "実機を確認しました: ${model_name}"
  else
    log_warn "MacBook Airではありません: ${model_name:-判定不能}。検査は続行しますが、常駐サービスは入れないでください。"
  fi
}

ensure_external_node_modules() {
  mkdir -p "${LOCAL_DEPENDENCY_ROOT}"

  if [[ -L "${PROJECT_NODE_MODULES}" ]]; then
    local current_target
    current_target="$(readlink "${PROJECT_NODE_MODULES}")"
    [[ "${current_target}" == "${EXTERNAL_NODE_MODULES}" ]] || {
      log_error "node_modulesのリンク先が想定外です: ${current_target}"
      return 1
    }
    mkdir -p "${EXTERNAL_NODE_MODULES}"
    return 0
  fi

  if [[ -e "${PROJECT_NODE_MODULES}" ]]; then
    [[ ! -e "${EXTERNAL_NODE_MODULES}" ]] || {
      log_error "プロジェクト内とApplication Supportの両方にnode_modulesがあります。自動上書きしません。"
      return 1
    }
    mv "${PROJECT_NODE_MODULES}" "${EXTERNAL_NODE_MODULES}"
  else
    mkdir -p "${EXTERNAL_NODE_MODULES}"
  fi
  ln -s "${EXTERNAL_NODE_MODULES}" "${PROJECT_NODE_MODULES}"
  log_info "node_modulesをiCloud同期外へ配置しました: ${EXTERNAL_NODE_MODULES}"
}

main() {
  cd "${PROJECT_DIR}"
  validate_machine
  require_command node
  require_command pnpm
  require_command sqlite3
  require_command curl
  validate_node_version
  validate_pnpm_version
  validate_environment_file
  bash "${SCRIPT_DIR}/macbook-air-service.sh" validate

  if [[ "${CHECK_ONLY}" == "true" ]]; then
    log_info "事前検査に成功しました。ファイル変更や依存導入は行っていません。"
    return 0
  fi

  ensure_external_node_modules
  log_info "lockfile固定で依存関係を同期します"
  pnpm install --frozen-lockfile --modules-dir "${EXTERNAL_NODE_MODULES}"
  log_info "SQLite migrationを適用します"
  pnpm migration
  log_info "lint・型検査・unit testを実行します"
  pnpm check
  log_info "MacBook Airのローカル環境構築が完了しました"
  log_info "旧MacのBot停止を確認後、pnpm service:install を実行してください"
}

main
