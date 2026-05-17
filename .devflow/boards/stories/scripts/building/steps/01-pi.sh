#!/usr/bin/env bash
# Loop step 01: Run pi build-story or skip if DEVFLOW_SKIP_PI=1
set -euo pipefail
board="${1:?board name required}"
card_id="${2:?card id required}"
: "$board" "$card_id"

SCRIPT_ID="building/steps/01-pi"
repo_root="${DEVFLOW_REPO_ROOT:?DEVFLOW_REPO_ROOT not set}"
card_md="${DEVFLOW_CARD_MD:-${DEVFLOW_CARD_DIR:?DEVFLOW_CARD_DIR not set}/card.md}"
skill_dir="${DEVFLOW_BOARD_DIR:?DEVFLOW_BOARD_DIR not set}/skills/build-story"
run_dir="${DEVFLOW_RUN_DIR:?DEVFLOW_RUN_DIR not set}"
board_dir="${DEVFLOW_BOARD_DIR:?DEVFLOW_BOARD_DIR not set}"
round="${DEVFLOW_SCRIPT_ROUND:-1}"
max="${DEVFLOW_LOOP_MAX:-1}"
lib_dir="${board_dir}/scripts/lib"

log_info() {
  [ "${DEVFLOW_LOG_LEVEL:-info}" = "summary" ] && return 0
  printf '\033[90m%s (round %s/%s): %s\033[0m\n' "$SCRIPT_ID" "$round" "$max" "$*" >&2
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

# shellcheck source=../../lib/pi-prompt.sh
source "${lib_dir}/pi-prompt.sh"
prompt="$(pi_prompt_phase build-story implement)"
if [ "$round" -gt 1 ] && [ -f "${lib_dir}/building-loop-feedback.sh" ]; then
  # shellcheck source=../../lib/building-loop-feedback.sh
  source "${lib_dir}/building-loop-feedback.sh"
  feedback="$(building_loop_feedback "$run_dir" "$round")"
  if [ -n "$feedback" ]; then
    prompt="${prompt}

Previous build loop round failed. Read Build Notes in ${card_md}, then fix these errors before new work:
---
${feedback}
---"
    log_info "including prior-round gate output in pi prompt"
  fi
fi

log_info "invoking pi (build-story) with ${DEVFLOW_MEDIUM_MODEL}"
cd "$repo_root"

renderer="${board_dir}/scripts/lib/pi-render.sh"
set -o pipefail
pi --skill "$skill_dir" --model "${DEVFLOW_MEDIUM_MODEL}" --print --mode json \
  "$prompt" \
  | "$renderer"
exit ${PIPESTATUS[0]}
