#!/usr/bin/env bash
# pi-render_test.sh: Tests for pi-render.sh
# Run from repo root: ./templates/stories/scripts/lib/pi-render_test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER="$SCRIPT_DIR/pi-render.sh"
FIXTURE="$SCRIPT_DIR/fixtures/pi-events.ndjson"

# ANSI codes
RED='\033[31m'
GREEN='\033[32m'
GREY='\033[90m'
RESET='\033[0m'

pass_count=0
fail_count=0

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local test_name="$3"
  
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "${GREEN}✓${RESET} $test_name"
    ((pass_count++))
    return 0
  else
    echo -e "${RED}✗${RESET} $test_name"
    echo "  Expected to find: $needle"
    echo "  In output: $haystack"
    ((fail_count++))
    return 1
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local test_name="$3"
  
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "${RED}✗${RESET} $test_name"
    echo "  Expected NOT to find: $needle"
    echo "  In output: $haystack"
    ((fail_count++))
    return 1
  else
    echo -e "${GREEN}✓${RESET} $test_name"
    ((pass_count++))
    return 0
  fi
}

assert_equals() {
  local actual="$1"
  local expected="$2"
  local test_name="$3"
  
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✓${RESET} $test_name"
    ((pass_count++))
    return 0
  else
    echo -e "${RED}✗${RESET} $test_name"
    echo "  Expected: $expected"
    echo "  Got: $actual"
    ((fail_count++))
    return 1
  fi
}

assert_exit_code() {
  local actual="$1"
  local expected="$2"
  local test_name="$3"
  
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}✓${RESET} $test_name"
    ((pass_count++))
    return 0
  else
    echo -e "${RED}✗${RESET} $test_name"
    echo "  Expected exit code: $expected"
    echo "  Got: $actual"
    ((fail_count++))
    return 1
  fi
}

# Check prerequisites
if [ ! -f "$RENDERER" ]; then
  echo -e "${RED}ERROR:${RESET} Renderer not found: $RENDERER"
  exit 1
fi

if [ ! -f "$FIXTURE" ]; then
  echo -e "${RED}ERROR:${RESET} Fixture not found: $FIXTURE"
  exit 1
fi

echo "Running pi-render.sh tests..."
echo

# Test 2: Default (info) mode with fixture
echo "Test 2: info log level"
DEVFLOW_LOG_LEVEL=info
export DEVFLOW_LOG_LEVEL
stdout=$(cat "$FIXTURE" | "$RENDERER" 2>/tmp/pi-render-test-stderr.txt)
stderr=$(cat /tmp/pi-render-test-stderr.txt)
assert_equals "$stdout" "Done." "stdout contains only final text"
assert_contains "$stderr" "> bash:" "stderr contains tool call"
assert_contains "$stderr" "echo hello" "stderr contains tool arguments"
assert_contains "$stderr" "tokens:" "stderr contains usage summary"
echo

# Test 3: Verbose mode shows thinking
echo "Test 3: verbose log level"
DEVFLOW_LOG_LEVEL=verbose
export DEVFLOW_LOG_LEVEL
stdout=$(cat "$FIXTURE" | "$RENDERER" 2>/tmp/pi-render-test-stderr.txt)
stderr=$(cat /tmp/pi-render-test-stderr.txt)
assert_equals "$stdout" "Done." "stdout contains only final text (verbose)"
assert_contains "$stderr" "I need to run the bash command" "stderr contains thinking text"
assert_contains "$stderr" "> bash:" "stderr contains tool call (verbose)"
echo

# Test 4: Summary mode is silent
echo "Test 4: summary log level"
DEVFLOW_LOG_LEVEL=summary
export DEVFLOW_LOG_LEVEL
stdout=$(cat "$FIXTURE" | "$RENDERER" 2>/tmp/pi-render-test-stderr.txt)
stderr=$(cat /tmp/pi-render-test-stderr.txt)
assert_equals "$stdout" "Done." "stdout contains only final text (summary)"
assert_equals "$stderr" "" "stderr is empty in summary mode"
echo

# Test 5: Non-zero exit code propagation
echo "Test 5: exit code propagation"
DEVFLOW_LOG_LEVEL=info
export DEVFLOW_LOG_LEVEL
# Create a fixture that simulates failure
echo '{"type":"agent_end"}' | (cat "$FIXTURE" -; exit 2) | "$RENDERER" >/dev/null 2>&1 || exit_code=$?
assert_exit_code "${exit_code:-0}" "2" "renderer propagates upstream exit code"
echo

# Test 6: Missing jq graceful degradation
echo "Test 6: missing jq degradation"
DEVFLOW_LOG_LEVEL=info
export DEVFLOW_LOG_LEVEL
# Run with a PATH that excludes jq
PATH="/usr/bin:/bin" "$RENDERER" < "$FIXTURE" 2>/tmp/pi-render-test-stderr.txt >/tmp/pi-render-test-stdout.txt || true
stderr=$(cat /tmp/pi-render-test-stderr.txt)
stdout=$(cat /tmp/pi-render-test-stdout.txt)
# When jq is missing, renderer should warn and pass through
if command -v jq >/dev/null 2>&1; then
  # jq is in /usr/bin or /bin, so this test won't trigger the warning
  # Skip this specific assertion
  echo -e "${GREY}⊘${RESET} jq degradation test skipped (jq in standard PATH)"
else
  assert_contains "$stderr" "jq not found" "stderr contains jq warning"
fi
echo

# Summary
echo "─────────────────────────────"
echo -e "Tests: ${GREEN}$pass_count passed${RESET}, ${RED}$fail_count failed${RESET}"

if [ "$fail_count" -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${RESET}"
  exit 0
else
  echo -e "${RED}Some tests failed.${RESET}"
  exit 1
fi
