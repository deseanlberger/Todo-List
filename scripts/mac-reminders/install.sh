#!/bin/bash
#
# Installs the half-hourly reminder sync as a launchd agent.
#
#   ./install.sh            install (or reinstall) and fire it once
#   ./install.sh --remove   stop it and remove it
#
# This exists because the plist has to carry an absolute path to the script
# and a plist cannot expand $HOME. Leaving that as "edit this line yourself"
# is a step that gets skipped, and launchctl does NOT check whether the path
# exists — it loads a broken job happily and then fails silently on every run.
# That happened. So the path is filled in here, and the install verifies
# itself rather than trusting that it worked.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.odyssey.reminders-sync"
AGENTS="$HOME/Library/LaunchAgents"
INSTALLED="$AGENTS/$LABEL.plist"

if [ "${1:-}" = "--remove" ]; then
  launchctl unload "$INSTALLED" 2>/dev/null || true
  rm -f "$INSTALLED"
  echo "Removed. Nothing is scheduled any more."
  exit 0
fi

if [ ! -f "$DIR/sync-reminders.sh" ]; then
  echo "sync-reminders.sh is not next to this script. Run it from the folder it lives in." >&2
  exit 1
fi

if [ ! -f "$DIR/config.sh" ]; then
  echo "No config.sh. Copy config.example.sh to config.sh and fill it in first." >&2
  echo "The scheduled job cannot ask you for a secret at 6am." >&2
  exit 1
fi

# Unload any previous copy before overwriting it, or launchd keeps running
# the old one.
launchctl unload "$INSTALLED" 2>/dev/null || true

mkdir -p "$AGENTS"
sed "s|/Users/CHANGE_ME/reminders-sync|$DIR|" "$DIR/$LABEL.plist" > "$INSTALLED"

# Refuse to load a job pointed at nothing. launchctl will not catch this.
PROGRAM="$(grep -o '/[^<]*sync-reminders\.sh' "$INSTALLED" | head -1)"
if [ -z "$PROGRAM" ] || [ ! -x "$PROGRAM" ]; then
  echo "The installed plist points at '$PROGRAM', which is not an executable file." >&2
  rm -f "$INSTALLED"
  exit 1
fi

launchctl load "$INSTALLED"
echo "Installed. Runs at :05 and :35 every hour, from $PROGRAM"
echo

echo "Firing it once now to prove it works..."
launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 20

echo
echo "--- last run ---"
cat /tmp/odyssey-reminders-sync.out 2>/dev/null || echo "(nothing on stdout yet)"
if [ -s /tmp/odyssey-reminders-sync.err ]; then
  echo "--- errors ---"
  cat /tmp/odyssey-reminders-sync.err
fi
echo
echo "To stop it later:  ./install.sh --remove"
