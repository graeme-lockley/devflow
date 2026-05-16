# Shared helpers for building exit scripts (not invoked by Devflow).
# shellcheck shell=bash

# Match deno.json "test" / "ci" task permissions.
BUILDING_DENO_TEST_FLAGS=(
  --allow-read
  --allow-write
  --allow-run
  --allow-env
)

building_section_body() {
  local card_md="$1"
  local heading="$2"
  awk -v h="$heading" '
    $0 == "## " h { found=1; next }
    found && /^## / { exit }
    found { print }
  ' "$card_md"
}

# Populates BUILDING_SCENARIO_COMMANDS array from card.md Test Scenarios.
building_collect_scenario_commands() {
  local card_md="$1"
  BUILDING_SCENARIO_COMMANDS=()
  local scenarios
  scenarios=$(building_section_body "$card_md" "Test Scenarios")
  local line cmd
  while IFS= read -r line; do
    [[ "$line" =~ \|[[:space:]]*automated[[:space:]]*\| ]] || continue
    while IFS= read -r cmd; do
      [ -n "$cmd" ] && BUILDING_SCENARIO_COMMANDS+=("$cmd")
    done < <(printf '%s\n' "$line" | grep -oE '`deno test[^`]+`' | tr -d '`')
  done <<< "$scenarios"
}

# Run one `deno test …` scenario with repo test permissions.
building_run_deno_test_cmd() {
  local cmd="$1"
  if [[ "$cmd" != deno\ test* ]]; then
    echo "building: expected command to start with 'deno test': ${cmd}" >&2
    return 1
  fi
  local rest="${cmd#deno test }"
  # shellcheck disable=SC2086
  deno test "${BUILDING_DENO_TEST_FLAGS[@]}" $rest
}

# Run all automated scenario commands; optional log file captures combined output.
# Returns 0 on success. Sets BUILDING_SCENARIO_FAILURE_CMD on failure.
building_run_scenario_tests() {
  local card_md="$1"
  local log_file="${2:-}"

  BUILDING_SCENARIO_FAILURE_CMD=""
  building_collect_scenario_commands "$card_md"

  if [ "${#BUILDING_SCENARIO_COMMANDS[@]}" -eq 0 ]; then
    echo "building: no automated Test Scenarios with deno test commands found" >&2
    return 1
  fi

  local cmd test_file
  for cmd in "${BUILDING_SCENARIO_COMMANDS[@]}"; do
    if [[ "$cmd" == *…* ]] || [[ "$cmd" == *"..."* ]]; then
      echo "building: skipping placeholder scenario: ${cmd}" >&2
      continue
    fi
    test_file=""
    local arg
    for arg in $cmd; do
      if [[ "$arg" == *_test.ts ]]; then
        test_file="$arg"
        break
      fi
    done
    if [ -n "$test_file" ] && [ ! -f "$test_file" ]; then
      BUILDING_SCENARIO_FAILURE_CMD="$cmd"
      echo "building: test file not found: ${test_file} (from: ${cmd})" >&2
      return 1
    fi

    echo "building: running scenario: ${cmd}" >&2
    if [ -n "$log_file" ]; then
      {
        echo "--- scenario: ${cmd} ---"
        building_run_deno_test_cmd "$cmd"
      } >>"$log_file" 2>&1 || {
        BUILDING_SCENARIO_FAILURE_CMD="$cmd"
        echo "--- scenario failed: ${cmd} ---" >>"$log_file"
        return 1
      }
    elif ! building_run_deno_test_cmd "$cmd"; then
      BUILDING_SCENARIO_FAILURE_CMD="$cmd"
      return 1
    fi
  done
  return 0
}
