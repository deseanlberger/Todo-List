# Reminders sync, Mac side

Reads your open reminders out of Reminders.app every morning and posts them
into the scheduler, sorted into categories.

## Why this runs on your Mac and not on the server

Apple Reminders has no cloud API. There is no endpoint, public or private,
that iCloud exposes for it. Reminders live behind EventKit, which is only
reachable from code running on a signed-in Apple device.

So the server cannot pull. Your Mac has to push. That is what this is.

## What gets sorted, and what still asks

Every reminder is classified on arrival: category, location, how long it
needs, and financial impact.

The sorter is allowed to say it does not know. A reminder is one line you
typed to yourself, sometimes months ago, and plenty of them are too thin to
classify — `Thibodo` is a real reminder and nothing can tell you what it
means. Those arrive flagged and sit on Today under **From Reminders** for one
tap.

Category decides block size, which windows a task may occupy, and how it
ranks against everything else. A wrong confident answer puts work in the
wrong length of block in a window it does not belong in, and you would not
notice until the day ran wrong. That is why the uncertain ones ask.

**Without `ANTHROPIC_API_KEY` set on the project**, nothing is ever confident:
you get a keyword guess on each one and every item queues for a tap. Useful,
but the tap is the point of setting the key.

## Setup

Step 3 (the dry run) works on its own. Steps 1 and 2 are only needed to
actually send.

### 1. On Vercel, once

Both of these go in **Settings → Environment Variables**, ticked for
Production, then **Redeploy** (env vars only load at build time):

| Variable | Why |
| --- | --- |
| `INBOX_SECRET` | Required. Without it `/api/inbox` returns 503 and this script has nothing to talk to. |
| `ANTHROPIC_API_KEY` | Optional. Without it every reminder lands in the queue instead of being sorted. |

### 2. On your Mac

```sh
cd ~/Todo-List/scripts/mac-reminders     # wherever you cloned it
cp config.example.sh config.sh
# edit config.sh: paste the same INBOX_SECRET you put in Vercel
chmod 600 config.sh
```

`config.sh` is gitignored. The secret does not go in the repo.

### 3. Dry run first — needs none of step 1 or 2

```sh
./sync-reminders.sh --dry-run
```

A dry run reads your reminders and prints them. It posts nothing, so it
needs no `config.sh`, no secret, and nothing set on Vercel. Run this first,
before any of the setup above, to see what it would pick up.

**The first run will prompt for permission** to control Reminders. Accept it.
If you miss the prompt, the script tells you what happened rather than quietly
posting an empty list, and you can grant it at
**System Settings → Privacy & Security → Automation**.

The dry run prints exactly what would be sent and posts nothing. Read it
before you trust it.

### 4. Send for real

```sh
./sync-reminders.sh
```

You get back something like:

```json
{"imported": 12, "skipped": 0, "sorted": 9, "needsReview": 3}
```

- `imported` — new tasks created
- `skipped` — already imported on a previous run
- `sorted` — confident enough to use as-is
- `needsReview` — waiting for one tap on Today

### 5. Make it automatic

```sh
# edit the path inside the plist first
cp com.odyssey.reminders-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.odyssey.reminders-sync.plist
```

Runs at 6:05am. Unlike cron, launchd defers a run it missed rather than
skipping it, so a sleeping Mac catches up on wake.

To stop it:

```sh
launchctl unload ~/Library/LaunchAgents/com.odyssey.reminders-sync.plist
```

## Re-posting every day is safe

Each reminder carries its Reminders.app id, which is stable for the life of
the reminder. The server imports each id exactly once, so posting the whole
list every morning creates nothing twice. A reminder with no readable id
falls back to its title, which is the better of two imperfect options: the
same text is almost certainly the same reminder, and that beats importing it
fresh every day forever.

Completed reminders are not sent. Finishing something in Reminders.app does
not reach back and complete the task here — the two lists are not a two-way
sync, and this script only moves work in one direction.

## When it fails

Logs: `/tmp/odyssey-reminders-sync.out` and `.err`.

| What you see | What it means |
| --- | --- |
| `503 Inbox is not configured` | `INBOX_SECRET` is not set on Vercel, or it was set and not redeployed. |
| `401 Bad secret` | `config.sh` and Vercel do not match. |
| `Could not read Reminders` | Automation permission not granted. See step 3. |
| `No config.sh` on a real send | Expected. Dry runs work without it; sending does not. |
| Everything in `needsReview` | Expected with no `ANTHROPIC_API_KEY`. |

## Not tested on a real Mac

This was written and reviewed in a Linux container with no Reminders.app, so
the server half is tested end to end and the JXA reader is not. Run the dry
run first. If it errors, send me the output and I will fix it.
