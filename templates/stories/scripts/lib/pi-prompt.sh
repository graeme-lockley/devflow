# pi-prompt.sh — one-shot pi prompt helpers (source from phase scripts; do not execute)

# Resolve absolute card paths (honours DEVFLOW_CARD_MD when preset by Devflow).
_pi_resolve_card_paths() {
  _PI_CARD_DIR="${DEVFLOW_CARD_DIR:?DEVFLOW_CARD_DIR not set}"
  _PI_CARD_MD="${DEVFLOW_CARD_MD:-${_PI_CARD_DIR}/card.md}"
  _PI_STATE_JSON="${DEVFLOW_STATE_JSON:-${_PI_CARD_DIR}/state.json}"
  _PI_CARD_ID="${DEVFLOW_CARD_ID:?DEVFLOW_CARD_ID not set}"
}

# Usage: pi_prompt_phase "prepare-story" "prepare"
# Prints prompt text to stdout.
pi_prompt_phase() {
  local skill_name="$1"
  local action="$2"
  _pi_resolve_card_paths
  printf 'Using the skill %s, %s %s. Card file: %s. State (read-only): %s. Use these absolute paths directly; do not search for the card.' \
    "$skill_name" "$action" "$_PI_CARD_ID" "$_PI_CARD_MD" "$_PI_STATE_JSON"
}

# Usage: pi_prompt_commit "building" "verifying"
pi_prompt_commit() {
  local from_phase="$1"
  local to_phase="$2"
  _pi_resolve_card_paths
  printf 'Using the commit-message skill, write a Conventional Commits message for %s (%s) transitioning from %s to %s. Output only the commit message on stdout.' \
    "$_PI_CARD_ID" "$_PI_CARD_MD" "$from_phase" "$to_phase"
}
