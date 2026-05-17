#!/usr/bin/env bash
# Emit prior-round gate output for pi retry prompts (sourced by building/steps/01-pi.sh).
# shellcheck shell=bash

building_loop_feedback() {
  local run_dir="${1:?run_dir required}"
  local round="${2:?round required}"
  local prev=$((round - 1))
  local log path excerpt max_lines=100

  if [ "$prev" -lt 1 ]; then
    return 0
  fi

  if [ -f "${run_dir}/loop-failure-summary.txt" ]; then
    printf '### loop-failure-summary.txt (latest gate failure)\n'
    cat "${run_dir}/loop-failure-summary.txt"
    printf '\n\n'
  fi

  for log in "ci-round-${prev}.log" "scenarios-round-${prev}.log" "fmt-round-${prev}.log"; do
    path="${run_dir}/${log}"
    [ -f "$path" ] || continue
    printf '### %s (round %s)\n' "$log" "$prev"
    excerpt="$(tail -n "$max_lines" "$path")"
    printf '%s\n\n' "$excerpt"
  done
}
