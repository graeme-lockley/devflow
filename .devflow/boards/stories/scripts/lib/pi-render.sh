#!/usr/bin/env bash
# pi-render.sh: Render pi --mode json events as human-readable output
# Usage: pi --print --mode json "prompt" | pi-render.sh
#
# Reads NDJSON events on stdin, emits coloured progress lines on stderr,
# writes final assistant text to stdout. Honours DEVFLOW_LOG_LEVEL.
# Requires jq; degrades gracefully with a warning if missing.

set -euo pipefail

# Exit with upstream pi status (via pipefail)
trap 'exit $?' EXIT

# Detect log level (default: info)
LOG_LEVEL="${DEVFLOW_LOG_LEVEL:-info}"

# ANSI colour helpers (only on TTY stderr)
if [ -t 2 ]; then
  GREY='\033[90m'
  ITALIC_GREY='\033[3;90m'
  RESET='\033[0m'
else
  GREY=''
  ITALIC_GREY=''
  RESET=''
fi

# Check for jq
if ! command -v jq >/dev/null 2>&1; then
  if [ "$LOG_LEVEL" != "summary" ]; then
    printf '%bWarning: jq not found; pi events will not be rendered%b\n' "$GREY" "$RESET" >&2
  fi
  # Pass through stdin to stdout unchanged
  cat
  exit 0
fi

# Accumulator for final assistant text
final_text=""

# Silent mode for summary log level
silent=false
if [ "$LOG_LEVEL" = "summary" ]; then
  silent=true
fi

# Current tool call tracking (for sequential processing)
current_tool_name=""
current_tool_args=""

# Process each NDJSON line
while IFS= read -r line; do
  event_type=$(echo "$line" | jq -r '.type // empty')
  
  case "$event_type" in
    message_update)
      # Extract assistant message event type
      msg_type=$(echo "$line" | jq -r '.assistantMessageEvent.type // empty')
      
      case "$msg_type" in
        thinking_delta)
          # Only show thinking at verbose level
          if [ "$LOG_LEVEL" = "verbose" ] && [ "$silent" = "false" ]; then
            delta=$(echo "$line" | jq -r '.assistantMessageEvent.delta // empty')
            if [ -n "$delta" ]; then
              printf '%b%s%b' "$ITALIC_GREY" "$delta" "$RESET" >&2
            fi
          fi
          ;;
        
        thinking_end)
          # Newline after thinking block (verbose only)
          if [ "$LOG_LEVEL" = "verbose" ] && [ "$silent" = "false" ]; then
            echo >&2
          fi
          ;;
        
        toolcall_start)
          # Start of tool call - reset current tool tracking
          current_tool_name=""
          current_tool_args=""
          ;;
        
        toolcall_delta)
          # Accumulate tool call arguments (not used, we use toolcall_end)
          :
          ;;
        
        toolcall_end)
          # Render one concise line for the tool call
          if [ "$silent" = "false" ]; then
            tool_name=$(echo "$line" | jq -r '.assistantMessageEvent.toolCall.name // empty')
            args=$(echo "$line" | jq -r '.assistantMessageEvent.toolCall.arguments // empty')
            
            if [ -n "$tool_name" ] && [ "$args" != "null" ] && [ -n "$args" ]; then
              # Extract primary argument based on tool name
              case "$tool_name" in
                bash)
                  primary=$(echo "$args" | jq -r '.command // empty')
                  ;;
                read)
                  primary=$(echo "$args" | jq -r '.path // empty')
                  ;;
                write)
                  primary=$(echo "$args" | jq -r '.path // empty')
                  ;;
                edit)
                  primary=$(echo "$args" | jq -r '.path // empty')
                  ;;
                browse_page)
                  primary=$(echo "$args" | jq -r '.url // empty')
                  ;;
                *)
                  # Generic fallback: show first non-empty value
                  primary=$(echo "$args" | jq -r 'to_entries | .[0].value // empty')
                  ;;
              esac
              
              if [ -n "$primary" ]; then
                printf '%b%s:%b %s\n' "$GREY" "$tool_name" "$RESET" "$primary" >&2
              fi
            fi
          fi
          ;;
        
        text_delta)
          # Assistant text output
          delta=$(echo "$line" | jq -r '.assistantMessageEvent.delta // empty')
          if [ -n "$delta" ]; then
            # Accumulate for stdout
            final_text="${final_text}${delta}"
            # Also echo live to stderr (unless silent)
            if [ "$silent" = "false" ]; then
              printf '%s' "$delta" >&2
            fi
          fi
          ;;
      esac
      ;;
    
    tool_execution_start)
      # Tool execution started - suppress (redundant with toolcall_end)
      :
      ;;
    
    tool_execution_end)
      # Tool execution completed
      is_error=$(echo "$line" | jq -r '.isError // false')
      if [ "$silent" = "false" ]; then
        if [ "$is_error" = "true" ]; then
          printf '%b  Tool failed%b\n' "$GREY" "$RESET" >&2
        fi
      fi
      ;;
    
    message_end)
      # Message completed
      stop_reason=$(echo "$line" | jq -r '.message.stopReason // empty')
      if [ "$stop_reason" = "endTurn" ] && [ "$silent" = "false" ]; then
        # Extract usage if available
        usage=$(echo "$line" | jq -r '.message.usage // empty')
        if [ -n "$usage" ] && [ "$usage" != "null" ]; then
          input_tokens=$(echo "$usage" | jq -r '.input // 0')
          output_tokens=$(echo "$usage" | jq -r '.output // 0')
          if [ "$input_tokens" != "0" ] || [ "$output_tokens" != "0" ]; then
            printf '\n%b[tokens: in=%s out=%s]%b\n' "$GREY" "$input_tokens" "$output_tokens" "$RESET" >&2
          fi
        fi
      fi
      ;;
    
    agent_end)
      # Agent finished
      if [ "$silent" = "false" ]; then
        echo >&2
      fi
      ;;
    
    *)
      # Unknown event type - pass through silently (no-op)
      :
      ;;
  esac
done

# Write final assistant text to stdout (clean, for downstream consumers)
printf '%s' "$final_text"
