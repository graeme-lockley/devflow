#!/usr/bin/env bash
# Loop step 04: Run Test Scenarios from card.md
set -euo pipefail
board="${1:?board name required}"
card_id="${2:?card id required}"
: "$board" "$card_id"

SCRIPT_ID="building/steps/04-gate-scenarios"
repo_root="${DEVFLOW_REPO_ROOT:?DEVFLOW_REPO_ROOT not set}"
run_dir="${DEVFLOW_RUN_DIR:?DEVFLOW_RUN_DIR not set}"
card_md="${DEVFLOW_CARD_DIR:?DEVFLOW_CARD_DIR not set}/card.md"
round="${DEVFLOW_SCRIPT_ROUND:-1}"
max="${DEVFLOW_LOOP_MAX:-1}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=../../building-lib.sh
source "${script_dir}/building-lib.sh"

log_info() {
  [ "${DEVFLOW_LOG_LEVEL:-info}" = "summary" ] && return 0
  printf '\033[90m%s (round %s/%s): %s\033[0m\n' "$SCRIPT_ID" "$round" "$max" "$*" >&2
}

log_info "running Test Scenarios from card.md"
cd "$repo_root"
gate_log="${run_dir}/scenarios-round-${round}.log"
if ! building_run_scenario_tests "$card_md" "$gate_log"; then
  log_info "Test Scenarios failed (see ${gate_log})"
  {
    echo "step: ${SCRIPT_ID}"
    echo "round: ${round}/${max}"
    echo "--- tail ---"
    tail -n 60 "$gate_log"
  } >"${run_dir}/loop-failure-summary.txt"
  exit 1
fi
rm -f "${run_dir}/loop-failure-summary.txt"
log_info "Test Scenarios passed"
exit 0
