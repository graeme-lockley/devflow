#!/usr/bin/env bash
# Loop step 01: Run pi build-story or skip if DEVFLOW_SKIP_PI=1
set -euo pipefail
board="${1:?board name required}"
card_id="${2:?card id required}"
: "$board" "$card_id"

SCRIPT_ID="building/steps/01-pi"
repo_root="${DEVFLOW_REPO_ROOT:?DEVFLOW_REPO_ROOT not set}"
card_md="${DEVFLOW_CARD_DIR:?DEVFLOW_CARD_DIR not set}/card.md"
skill_dir="${DEVFLOW_BOARD_DIR:?DEVFLOW_BOARD_DIR not set}/skills/build-story"

log_info() {
  [ "${DEVFLOW_LOG_LEVEL:-info}" = "summary" ] && return 0
  printf '\033[90m%s: %s\033[0m\n' "$SCRIPT_ID" "$*" >&2
}

if [ "${DEVFLOW_SKIP_PI:-}" = "1" ]; then
  log_info "DEVFLOW_SKIP_PI=1: skipping pi build-story"
  exit 0
fi

if ! command -v pi >/dev/null 2>&1; then
  echo "$SCRIPT_ID: ERROR: pi not on PATH" >&2
  exit 1
fi

if [ -z "${DEVFLOW_MEDIUM_MODEL:-}" ]; then
  echo "$SCRIPT_ID: ERROR: DEVFLOW_MEDIUM_MODEL is not set" >&2
  exit 1
fi

log_info "invoking pi (build-story) with ${DEVFLOW_MEDIUM_MODEL}"
cd "$repo_root"
exec pi --skill "$skill_dir" --model "${DEVFLOW_MEDIUM_MODEL}" --print \
  "Using the skill build-story, implement ${card_id}."
