#!/bin/bash
#
# Reads open reminders out of Reminders.app and posts them to the scheduler.
#
#   ./sync-reminders.sh --dry-run    print what would be sent, send nothing
#   ./sync-reminders.sh              send them
#
# --dry-run needs no config and no secret: it reads Reminders and prints,
# which is exactly what you want to check BEFORE setting anything up.
# Sending needs config.sh. See README.md.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Config is required to send and optional to preview.
if [ -f "$DIR/config.sh" ]; then
  # shellcheck source=/dev/null
  . "$DIR/config.sh"
elif [ "$DRY_RUN" = "0" ]; then
  echo "No config.sh. Copy config.example.sh to config.sh and fill it in," >&2
  echo "or run with --dry-run to read your reminders without sending." >&2
  exit 1
fi

if [ "$DRY_RUN" = "0" ]; then
  : "${APP_URL:?APP_URL is not set in config.sh}"
  : "${INBOX_SECRET:?INBOX_SECRET is not set in config.sh}"
fi

PAYLOAD="$(osascript -l JavaScript "$DIR/read-reminders.js")"

# The reader reports its own failures in the body rather than exiting, so a
# permission prompt that was never accepted says so instead of silently
# posting an empty list every morning.
if printf '%s' "$PAYLOAD" | grep -q '"error"'; then
  echo "Could not read Reminders:" >&2
  printf '%s\n' "$PAYLOAD" >&2
  echo >&2
  echo "Usually this means the automation permission has not been granted." >&2
  echo "System Settings > Privacy & Security > Automation, and allow the" >&2
  echo "terminal (or launchd) to control Reminders." >&2
  exit 1
fi

# Counted with grep, not python3: on a Mac with no Command Line Tools
# installed, /usr/bin/python3 is a stub that pops an install dialog, and a
# launchd job at 6am must never wait on a dialog nobody is there to click.
COUNT="$(printf '%s' "$PAYLOAD" | grep -o '"title"' | wc -l | tr -d ' ')"

if [ "$DRY_RUN" = "1" ]; then
  echo "Read $COUNT reminders. Sending nothing."
  [ -n "${APP_URL:-}" ] && echo "A real run would post them to $APP_URL/api/inbox"
  echo
  # plutil ships with macOS and needs no developer tools.
  printf '%s' "$PAYLOAD" | plutil -convert json -r -o - -- - 2>/dev/null \
    || printf '%s\n' "$PAYLOAD"
  exit 0
fi

echo "Posting $COUNT reminders to $APP_URL/api/inbox"

# --fail-with-body so a 401 or 503 prints the server's reason rather than
# just a bare exit code in a log nobody reads.
RESPONSE="$(curl --silent --show-error --fail-with-body \
  --max-time 120 \
  --request POST "$APP_URL/api/inbox" \
  --header "Authorization: Bearer $INBOX_SECRET" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD")" || {
  STATUS=$?
  echo "Post failed (curl exit $STATUS): $RESPONSE" >&2
  exit 1
}

echo "$RESPONSE"
