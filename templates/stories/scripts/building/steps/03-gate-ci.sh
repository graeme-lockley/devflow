#!/usr/bin/env bash
# Loop step 03: Run deno task ci
set -euo pipefail
board="${1:?board name required}"
card_id="${2:?card id required}"
: "$board" "$card_id"

SCRIPT_ID="building/steps/03-gate-ci"
repo_root="${DEVFLOW_REPO_ROOT:?DEVFLOW_REPO_ROOT not set}"
run_dir="${DEVFLOW_RUN_DIR:?DEVFLOW_RUN_DIR not set}"
round="${DEVFLOW_SCRIPT_ROUND:-1}"
max="${DEVFLOW_LOOP_MAX:-1}"

log_info() {
  [ "${DEVFLOW_LOG_LEVEL:-info}" = "summary" ] && return 0
  printf '\033[90m%s (round %s/%s): %s\033[0m\n' "$SCRIPT_ID" "$round" "$max" "$*" >&2
}

log_info "running deno task ci"
cd "$repo_root"
ci_log="${run_dir}/ci-round-${round}.log"
if ! deno task ci >"$ci_log" 2>&1; then
  log_info "deno task ci failed (see ${ci_log})"
  {
    echo "step: ${SCRIPT_ID}"
    echo "round: ${round}/${max}"
    echo "--- tail ---"
    tail -n 60 "$ci_log"
  } >"${run_dir}/loop-failure-summary.txt"
  exit 1
fi
rm -f "${run_dir}/loop-failure-summary.txt"
log_info "deno task ci passed"
exit 0
