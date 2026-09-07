# Odyssey Task Scheduler

A personal task capture and auto-scheduling app. Two halves:

1. **Capture** — tasks arrive by voice or text through a Telegram bot, get parsed by Claude into structured task data, and land in the backlog unscheduled.
2. **Schedule** — a manual **Schedule My Week** button lays the backlog into the open gaps in the real Google Calendar. Nothing is written until the diff is approved. Nothing moves without the button.

Next.js 15 (App Router) · TailwindCSS 4 · Supabase · Vercel.

## Run it

```bash
npm install
npm run dev
```

That is the whole setup. With no environment variables the app runs on a **seeded in-memory store** and a **stub calendar** that serves a realistic coaching week, so the scheduler has walls to fill around from the first click. Settings says plainly which of those are standing in.

To make it real, copy `.env.example` to `.env.local` and fill in what you have. Each block is independent — Supabase without Google, Google without Telegram, any combination works.

`POST /api/dev/reset` re-seeds the demo store. It refuses when Supabase is configured, so there is no path from it to real data.

```bash
npm test         # 70 tests, mostly the scheduler
npm run build
npm run lint
npm run typecheck
```

## Layout

```
src/
  lib/
    domain/      types, category metadata, time helpers, priority — no I/O
    scheduler/   the engine: availability, placement, diff — pure, no I/O
    data/        repository over Supabase, with the demo store behind it
    calendar/    Google Calendar adapter, with the stub behind it
    capture/     Claude parsing of captured messages, with a keyword fallback
  app/
    today/ week/ tasks/ delegate/ review/ settings/
    api/telegram/    the capture webhook
    api/reminders/   the daily lead-time reminder cron
supabase/migrations/0001_init.sql
docs/SCHEDULER_RULES.md    the rules the engine is written against
docs/DESIGN_HANDOFF.md     the UI spec the screens are built from
```

The engine takes the clock, the calendar, and the database as arguments and returns a layout. It is the part that has to be right, so it is the part with no dependencies and the most tests.

## The scheduling run

Pressing **Schedule My Week** does this and stops:

1. Read the target week's Google Calendar. Every event that is not ours is an immovable wall.
2. Load the week template and the one-off overrides; intersect them with the walls to get the open slots.
3. Place recurring tasks first, then everything else in computed priority order.
4. Insert reset gaps.
5. Diff the result against what is already on the calendar and **park it**.

Nothing is written. The diff lands on `/review` as plain-English sentences — *"Moving **Write SMHS volleyball block** from Tue 09:00 to Thu 09:00 to make room for **Payroll**, due Wednesday."* — and only **WRITE n CHANGES** touches Google Calendar.

`docs/SCHEDULER_RULES.md` is the specification; `src/lib/scheduler/scheduler.test.ts` walks its numbered sections in order, so a rule and its test are easy to read side by side.

Two things worth knowing about the implementation:

- **Priority is a lexicographic comparator, not a weighted sum.** The rules list the inputs in order of *authority* — recurring, then due proximity, then financial impact, then category weight. A weighted sum would let a big financial impact quietly outrank a recurring task. Due proximity buckets by calendar day rather than elapsed hours, so two tasks due the same afternoon land in the same bucket and financial impact actually gets to decide between them.
- **Location only ever acts on a positive gym signal.** The rule forbids putting a Home task in a gap spent at the gym; it does not claim to know where you are the rest of the time. Gym time is inferred from keywords in the calendar event's own title and location field, which is a heuristic and is meant to be — a misplacement is one tap to fix, and a stricter rule would leave real gaps empty.

## What is built

| Build-order step | State |
|---|---|
| 1. Schema + All Tasks | Done |
| 2. Week template + settings | Done |
| 3. Google Calendar read, week views | Done |
| 4. The scheduler + calendar write | Done |
| 5. Re-run diff, confirmation, Didn't Fit | Done |
| 6. Today + block close-out | Done |
| 7. Recurring tasks and lead-time reminders | Done — reminders need `TELEGRAM_CHAT_ID` and the daily cron |
| 8. Delegate list | Done |
| 9. Telegram bot, text capture | Done — needs `TELEGRAM_BOT_TOKEN` |
| 10. Voice transcription | Wired as a seam — needs `TRANSCRIPTION_URL` and a key. Without one the bot says so and asks for text rather than dropping the note |
| 11. The estimation learning loop | Completions are recorded and fed to the parser as examples; the estimate itself is Claude's, calibrated on that history |

Screens 1b and 1h were alternates the handoff marked as reference rather than the shipped answer, so they are not built. The delegation block itself (the recurring 30-minute slot) is a fixed label on the Delegate screen rather than a configurable recurring task.

## Where the handoff's numbers collided

The design is high fidelity and its values are reproduced exactly, with two exceptions where its own numbers do not fit in a 390px frame. Both are resolved in favour of information over layout:

- **The task meta line.** `HIGH PRIORITY ADMIN · HOME · DUE WED SEP 02` measures 248px at 9px Roboto Mono. The spec-mandated star row is 77px, which leaves 234px inside 20px screen padding and 11px card padding. So the *category* segment is the one allowed to shrink — it is already carried by the 3px rail — and the due date never truncates.
- **The week-template window row.** The spec gives the time range 92px, which is exactly wide enough to read `05:30 – 08:00` and far too narrow for a native time input. The range stays as type; tapping it opens a real picker on the row below.

One smaller judgment call: the sort explanation line on All Tasks runs to ~357px at 9px, wider than the 350px available, so it wraps to a second line rather than being cut.

## Deploying

Vercel, with the environment variables from `.env.example`. `vercel.json` registers the daily reminder cron at 14:00 UTC (07:00 Pacific). Point the Telegram webhook at `/api/telegram` and set `TELEGRAM_WEBHOOK_SECRET` to the same value you register with:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-app.vercel.app/api/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Apply `supabase/migrations/0001_init.sql` to your Supabase project before switching storage over. It ships with a seed week template, which the Week Template screen is there to edit.

## Deliberately not built

No dashboard, no charts, no stats page. No auto-scheduling on a timer or on task creation — the button is the only trigger. No partial-credit close-out. No squeezing work into sub-30-minute gaps. No writing to the calendar without an approved diff.
