#!/bin/bash
#
# Reads open reminders out of Reminders.app and posts them to the scheduler.
#
#   ./sync-reminders.sh              send them
#   ./sync-reminders.sh --dry-run    print what would be sent, send nothing
#
# Config lives in config.sh next to this script. See README.md.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ ! -f "$DIR/config.sh" ]; then
  echo "No config.sh. Copy config.example.sh to config.sh and fill it in." >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$DIR/config.sh"

: "${APP_URL:?APP_URL is not set in config.sh}"
: "${INBOX_SECRET:?INBOX_SECRET is not set in config.sh}"

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

COUNT="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("items", [])))' 2>/dev/null || echo "?")"

if [ "$DRY_RUN" = "1" ]; then
  echo "Would post $COUNT reminders to $APP_URL/api/inbox"
  echo
  printf '%s' "$PAYLOAD" | /usr/bin/python3 -m json.tool 2>/dev/null || printf '%s\n' "$PAYLOAD"
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
