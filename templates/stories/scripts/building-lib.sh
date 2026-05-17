# Shared helpers for building exit scripts (not invoked by Devflow).
# shellcheck shell=bash

# Spec Updates table: last column, trimmed (full status cell).
stories_spec_update_status_raw() {
  local line="$1"
  printf '%s' "$line" | awk -F'|' '{print $(NF-1)}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Spec Updates table: last column, first token only (allows "deferred (reason)", "done (…)" ).
stories_spec_update_status() {
  stories_spec_update_status_raw "$1" | awk '{print $1}'
}

# True when card.md (Build Notes or Notes) documents work on doc_path.
stories_doc_mentioned_in_card() {
  local doc_path="$1"
  local card_md="$2"
  local base="${doc_path##*/}"
  local body adr_id

  body=$(building_section_body "$card_md" "Build Notes")
  body+=$(printf '\n%s' "$(building_section_body "$card_md" "Notes")")

  if printf '%s' "$body" | grep -qF "$doc_path"; then
    return 0
  fi
  if printf '%s' "$body" | grep -qF "$base"; then
    return 0
  fi
  case "$doc_path" in
    docs/adr/[0-9][0-9][0-9][0-9]-*)
      adr_id=$(printf '%s' "$base" | sed -n 's/^\([0-9][0-9][0-9][0-9]\).*/ADR-\1/p')
      [ -n "$adr_id" ] && printf '%s' "$body" | grep -qF "$adr_id" && return 0
      ;;
  esac
  return 1
}

# Finishing: "done" row with no porcelain diff — shipped in an earlier hop or annotated pointer.
stories_spec_done_without_worktree_diff() {
  local doc_path="$1"
  local line="$2"
  local planned="$3"
  local card_md="$4"
  local repo_root="$5"
  local status_raw

  status_raw=$(stories_spec_update_status_raw "$line")

  if printf '%s' "$planned" | grep -qiE '^(none|n/a|verify|unchanged)'; then
    return 0
  fi
  if [[ "$status_raw" == done* ]] && [ "$status_raw" != "done" ]; then
    return 0
  fi
  if git -C "$repo_root" diff --quiet HEAD -- "$doc_path" 2>/dev/null \
    && git -C "$repo_root" rev-parse --verify "HEAD:${doc_path}" >/dev/null 2>&1; then
    if stories_doc_mentioned_in_card "$doc_path" "$card_md"; then
      return 0
    fi
  fi
  return 1
}

# True when card.md records permission to edit immutable docs (requirements, architecture, ADRs).
stories_immutable_doc_edit_allowed() {
  local card_md="$1"
  grep -qiE \
    'user[[:space:]]*'\''?s?[[:space:]]*(prior[[:space:]]+)?approval|explicitly[[:space:]]+approv|approved[[:space:]]+spec|authoris(e[ds]?|ing|ation)?|authorised[[:space:]]+to[[:space:]]+edit|immutable[- ][Dd]oc' \
    "$card_md"
}

# True when ## Notes documents a deferred Spec Updates row for doc_path.
stories_notes_deferred_justified() {
  local doc_path="$1"
  local notes="$2"
  local base="${doc_path##*/}"

  if printf '%s\n' "$notes" | grep -qiE "deferred.*${doc_path}|${doc_path}.*deferred"; then
    return 0
  fi
  if printf '%s\n' "$notes" | grep -qiE "deferred.*${base}|${base}.*deferred"; then
    return 0
  fi
  case "$doc_path" in
    docs/devflow-requirements.md)
      if printf '%s\n' "$notes" | grep -qiE 'deferred.*requirements|requirements.*deferred'; then
        return 0
      fi
      ;;
  esac
  if printf '%s\n' "$notes" | grep -qi 'deferred' \
    && printf '%s\n' "$notes" | grep -qF "$doc_path"; then
    return 0
  fi
  return 1
}

# Populates BUILDING_ALLOWED_DOC_PATHS from Spec Updates (done|pending rows).
building_collect_allowed_doc_paths() {
  local card_md="$1"
  BUILDING_ALLOWED_DOC_PATHS=()
  [ -f "$card_md" ] || return 0
  local line doc status
  while IFS= read -r line; do
    [[ "$line" =~ ^\|[[:space:]]*\`([^\`]+)\`[[:space:]]*\| ]] || continue
    doc="${BASH_REMATCH[1]}"
    status=$(stories_spec_update_status "$line")
    case "$status" in
      done|pending) BUILDING_ALLOWED_DOC_PATHS+=("$doc") ;;
    esac
  done < <(building_section_body "$card_md" "Spec Updates")
}

# True when card.md scopes this story to board.json / scripts / skills (e.g. loop stories).
stories_board_infrastructure_in_scope() {
  local card_md="$1"
  grep -qiE \
    'board\.json|phaseScripts|Stories board|/scripts/|/skills/|building/steps|refactor.*\.devflow/boards' \
    "$card_md"
}

# Set BUILDING_BOARD_REL and BUILDING_ALLOW_BOARD_INFRA=1 when card allows board infra edits.
building_apply_board_infra_scope() {
  local card_md="$1"
  local board_rel="$2"
  BUILDING_BOARD_REL=""
  BUILDING_ALLOW_BOARD_INFRA=0
  if stories_board_infrastructure_in_scope "$card_md"; then
    BUILDING_BOARD_REL="$board_rel"
    BUILDING_ALLOW_BOARD_INFRA=1
  fi
}

# True when path is allowed for story implementation (card, src, docs, README).
building_path_allowed_for_story() {
  local path="$1"
  local card_rel="$2"
  case "$path" in
    "${card_rel}"/*|"$card_rel") return 0 ;;
    src/*) return 0 ;;
    README.md) return 0 ;;
    deno.json|deno.lock) return 0 ;;
  esac
  if [ "${BUILDING_ALLOW_BOARD_INFRA:-0}" = 1 ] && [ -n "${BUILDING_BOARD_REL:-}" ]; then
    case "$path" in
      "${BUILDING_BOARD_REL}/board.json") return 0 ;;
      "${BUILDING_BOARD_REL}/scripts/"*) return 0 ;;
      "${BUILDING_BOARD_REL}/skills/"*) return 0 ;;
    esac
  fi
  local doc
  for doc in "${BUILDING_ALLOWED_DOC_PATHS[@]}"; do
    [ "$path" = "$doc" ] && return 0
  done
  return 1
}

# Invokes a function for each path in git status --porcelain: fn <path> [extra-args…]
building_foreach_porcelain_path() {
  local repo_root="$1"
  local fn="$2"
  shift 2
  local line path
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    path="${line:3}"
    if [[ "$path" == *" -> "* ]]; then
      path="${path##* -> }"
    fi
    path="${path#\"}"
    path="${path%\"}"
    "$fn" "$path" "$@"
  done < <(git -C "$repo_root" status --porcelain)
}

building_section_body() {
  local card_md="$1"
  local heading="$2"
  awk -v h="$heading" '
    $0 == "## " h { found=1; next }
    found && /^## / { exit }
    found { print }
  ' "$card_md"
}

# Preparing exit / planning entry: same bar as planning-002-check-card-structure.
# Echoes failures to stderr with optional prefix; returns 0 when ready.
stories_card_preparing_ready() {
  local card_md="$1"
  local prefix="${2:-stories}"
  local min_section_chars="${3:-40}"
  local heading body chars

  if [ ! -f "$card_md" ]; then
    echo "${prefix}: missing card.md" >&2
    return 1
  fi
  if ! head -1 "$card_md" | grep -q '^# '; then
    echo "${prefix}: card.md must start with a # title line" >&2
    return 1
  fi
  if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$card_md"; then
    echo "${prefix}: card.md contains merge conflict markers" >&2
    return 1
  fi
  for heading in \
    "Current State" \
    "Objectives" \
    "Spec References" \
    "Acceptance Criteria"; do
    grep -q "^## ${heading}$" "$card_md" || {
      echo "${prefix}: missing ## ${heading} section" >&2
      return 1
    }
  done
  if grep -q '_To be completed in preparing\.' "$card_md"; then
    echo "${prefix}: preparing sections still contain placeholders" >&2
    return 1
  fi
  for heading in "Current State" "Objectives"; do
    body=$(building_section_body "$card_md" "$heading" | sed '/^[[:space:]]*$/d' | sed '/^<!--/d')
    chars=$(printf '%s' "$body" | wc -c | tr -d ' ')
    if [ "${chars:-0}" -lt "$min_section_chars" ]; then
      echo "${prefix}: ## ${heading} is too short or empty (${chars:-0} < ${min_section_chars} chars)" >&2
      return 1
    fi
  done
  body=$(building_section_body "$card_md" "Acceptance Criteria")
  if ! printf '%s\n' "$body" | grep -qE '^[0-9]+\.[[:space:]]+\[[ xX]\]'; then
    echo "${prefix}: Acceptance Criteria must include at least one numbered criterion" >&2
    return 1
  fi
  body=$(building_section_body "$card_md" "Spec References")
  if ! printf '%s\n' "$body" | grep -qE '^- \[[ xX]\]'; then
    echo "${prefix}: Spec References must include at least one checklist item" >&2
    return 1
  fi
  return 0
}

# Populates BUILDING_SCENARIO_COMMANDS array from card.md Test Scenarios.
building_collect_scenario_commands() {
  local card_md="$1"
  BUILDING_SCENARIO_COMMANDS=()
  local scenarios
  scenarios=$(building_section_body "$card_md" "Test Scenarios")
  local line cmd path deno_cmd existing

  _scenario_cmds_add() {
    local candidate="$1"
    for existing in "${BUILDING_SCENARIO_COMMANDS[@]}"; do
      [ "$existing" = "$candidate" ] && return 0
    done
    BUILDING_SCENARIO_COMMANDS+=("$candidate")
  }

  while IFS= read -r line; do
    [[ "$line" =~ \|[[:space:]]*automated[[:space:]]*\| ]] || continue
    while IFS= read -r cmd; do
      [ -n "$cmd" ] && _scenario_cmds_add "$cmd"
    done < <(printf '%s\n' "$line" | grep -oE '`deno task test[^`]*|`deno test[^`]*`' | tr -d '`')
    while IFS= read -r path; do
      [ -n "$path" ] || continue
      deno_cmd="deno task test ${path}"
      _scenario_cmds_add "$deno_cmd"
    done < <(printf '%s\n' "$line" | grep -oE '`src/[^`]+\.ts`' | tr -d '`')
  done <<< "$scenarios"
}

# Run one `deno task test …` scenario (deno.json "test" task supplies permissions).
# Legacy card.md commands starting with `deno test` are normalized the same way.
building_run_test_cmd() {
  local cmd="$1"
  local rest=""
  if [[ "$cmd" == deno\ task\ test* ]]; then
    if [[ "$cmd" == deno\ task\ test\ * ]]; then
      rest="${cmd#deno task test }"
    fi
  elif [[ "$cmd" == deno\ test* ]]; then
    if [[ "$cmd" == deno\ test\ * ]]; then
      rest="${cmd#deno test }"
    fi
  else
    echo "building: expected command to start with 'deno task test': ${cmd}" >&2
    return 1
  fi
  if [ -z "$rest" ]; then
    deno task test
  else
    # shellcheck disable=SC2086
    deno task test $rest
  fi
}

# Run all automated scenario commands; optional log file captures combined output.
# Returns 0 on success. Sets BUILDING_SCENARIO_FAILURE_CMD on failure.
building_run_scenario_tests() {
  local card_md="$1"
  local log_file="${2:-}"

  BUILDING_SCENARIO_FAILURE_CMD=""
  building_collect_scenario_commands "$card_md"

  if [ "${#BUILDING_SCENARIO_COMMANDS[@]}" -eq 0 ]; then
    echo "building: no automated Test Scenarios with deno task test commands found" >&2
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
        building_run_test_cmd "$cmd"
      } >>"$log_file" 2>&1 || {
        BUILDING_SCENARIO_FAILURE_CMD="$cmd"
        echo "--- scenario failed: ${cmd} ---" >>"$log_file"
        return 1
      }
    elif ! building_run_test_cmd "$cmd"; then
      BUILDING_SCENARIO_FAILURE_CMD="$cmd"
      return 1
    fi
  done
  return 0
}
