#!/usr/bin/env bash
# Loop step 02: Format repository sources after pi edits (matches deno task fmt:check scope).
set -euo pipefail
board="${1:?board name required}"
card_id="${2:?card id required}"
: "$board" "$card_id"

SCRIPT_ID="building/steps/02-fmt"
repo_root="${DEVFLOW_REPO_ROOT:?DEVFLOW_REPO_ROOT not set}"
run_dir="${DEVFLOW_RUN_DIR:?DEVFLOW_RUN_DIR not set}"
round="${DEVFLOW_SCRIPT_ROUND:-1}"
max="${DEVFLOW_LOOP_MAX:-1}"

log_info() {
  [ "${DEVFLOW_LOG_LEVEL:-info}" = "summary" ] && return 0
  printf '\033[90m%s (round %s/%s): %s\033[0m\n' "$SCRIPT_ID" "$round" "$max" "$*" >&2
}

log_info "running deno fmt"
cd "$repo_root"
if ! deno fmt --ignore=.devflow >"${run_dir}/fmt-round-${round}.log" 2>&1; then
  log_info "deno fmt failed (see ${run_dir}/fmt-round-${round}.log)"
  exit 1
fi
log_info "deno fmt completed"
exit 0
