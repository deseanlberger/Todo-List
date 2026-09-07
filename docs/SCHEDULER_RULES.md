# Scheduler rules — Odyssey Task Scheduler

Everything the scheduling engine must obey. This is the part of the product that has to be right; the UI is documented in `README.md`.

The single governing principle: **read before write, and never write without approval.** The app pulls the real Google Calendar for the target week first and treats every existing event as an immovable wall — coaching sessions, the Thursday 2pm sales meeting, lifts, everything. The scheduler only fills unclaimed space.

---

## 1. Categories

Every task lands in exactly one bucket.

| Category | What goes here | Block size | Schedules onto calendar |
|---|---|---|---|
| Deep Focus | Program writing, anything requiring real thinking | 45 min | Yes |
| High Priority Admin | Important business items with a deadline | 30 min | Yes |
| Low Priority Admin | Gym housekeeping, nice-to-have items | 30 min | Yes |
| Personal | Non-business | 30 min | Yes |
| Delegate | Items to hand to Annie, Jake, or another coach | none | **No** |

A task can occupy multiple consecutive blocks. A three-block Deep Focus task is 135 minutes.

## 2. Block grid

- Deep Focus runs on **45 minute** units. Minimum one unit. A gap smaller than 45 minutes never receives Deep Focus work.
- Everything else runs on **30 minute** units.
- Multi-block tasks must be scheduled **consecutively**. Never split a task across the day.
- Leftover gaps under 30 minutes stay empty. This is a feature — do not "helpfully" squeeze something in.

## 3. Week template (availability)

**This constrains everything below.** The scheduler may only place work inside the windows defined in the week template (Settings → Week Template, screens 3a / 3b). Time outside a window is not available, even if the Google Calendar is empty.

- The template is a **recurring weekly pattern**: a set of windows per weekday, each with a start time, an end time, and an allowance.
- Allowances: `ANY` · `DEEP FOCUS` (only Deep Focus may land here) · `ADMIN ONLY` (any 30-minute category, never Deep Focus) · `NO WORK` (window is closed; kept in the list so it can be re-enabled without retyping it).
- Capacity readout = the sum of all non-`NO WORK` window minutes, and that figure ÷ 30 as a rough block count **before** reset gaps are deducted.
- Template edits apply on the **next** Schedule My Week run. Already-placed blocks are never retroactively moved by a template change.
- Claude collects the template once during setup by asking, then writes it. It must remain fully editable afterwards — the setup conversation is a convenience, not the source of truth.
- A one-off exception (travel, a closed gym day, a holiday) is an **override on a specific date**, stored separately from the recurring pattern so it doesn't corrupt it.

## 4. Reset gaps

Roughly every hour of work earns a 10 to 15 minute reset. The scheduler inserts these automatically.

- Two consecutive 30 minute blocks (60 minutes of work) → a **15 minute** gap after.
- One 45 minute Deep Focus block → a **10 to 15 minute** gap after.
- Resets go **between** tasks, never inside one. A two-block Deep Focus task runs its full 90 minutes uninterrupted, then takes its reset.
- Resets are **soft**. A task can be dropped into a reset gap manually, but the app warns first — *"You're overriding your 15 minute reset block."* — and then allows it. It warns; it does not block.
- Reset length is a setting (10 or 15 min). Default 15.

## 5. Deep Focus cap

- Monday through Friday: **maximum 3** Deep Focus blocks per day (configurable).
- Saturday and Sunday: **uncapped**.
- Once the weekday cap is hit, additional Deep Focus tasks roll to the next day with room, or into the weekend.
- The cap counts **blocks, not tasks**. One two-block Deep Focus task consumes 2 of the 3.

## 6. Location context

Every task carries a location tag: **Gym** or **Home**.

- Claude infers it on capture from context. Maintenance, equipment, facility, or anything physically tied to the building reads as **Gym**. Programming, email, finances, and most admin read as **Home**.
- The tag is always shown and always one tap to change.
- The scheduler matches the tag against the existing calendar: if the user is at the gym coaching from 15:00 to 19:00, a Home task may not be placed in the 17:00 gap. Conversely a Gym task placed at 14:30 is *good* if the calendar shows them at the gym from 14:00 — say so in the diff.

## 7. Priority

Ranking is **computed, never typed in**. Inputs, in order of authority:

1. **Recurring flag.** Always ranks above everything else. Never bumped, never listed in a move list.
2. **Due date proximity.** Closer means higher.
3. **Financial impact** — the 1–5 value. Payroll and rent are 5; reorganizing a shelf is 1. **This is the star rating the user sets on the All Tasks screen.** There is exactly one such field; the stars are its editor.
4. **Category weight.** Deep Focus and High Priority Admin outrank Low Priority Admin and Personal at equal scores.

## 8. Urgency

- Any task with a due date **inside 48 hours** is flagged urgent. Derived, not stored as user input.
- Urgent tasks surface at the top of All Tasks and Today regardless of category, and are visually marked in the week grid.
- **Urgent tasks can never land in Didn't Fit.** If an urgent task has nowhere to go, the scheduler raises it as a conflict on the confirmation screen and names what it would have to bump.

## 9. Placement order

1. Pull the target week's Google Calendar. Every event is a wall.
2. Load the week template; intersect it with the walls to produce the set of open windows.
3. Place **recurring tasks first**, before any other task is considered.
4. Place remaining tasks in computed priority order, respecting: block size, window allowance, consecutive-block requirement, location match, and the Deep Focus cap.
5. Insert reset gaps.
6. Anything left over goes to **Didn't Fit** (except urgent tasks — see §8).

## 10. Calendar write

- Blocks are written as Google Calendar events with a **clear prefix** so they are visually distinct from real appointments and easy to bulk-delete on a re-run.
- Store the `gcal_event_id` on every scheduled block so the diff can update or delete precisely rather than clearing the week.
- Calendar notifications for block starts only. **No Telegram ping when a block begins.**

## 11. Re-run behavior

When Schedule My Week is pressed and blocks already exist:

1. Compute the ideal layout with the new tasks included.
2. Diff it against what is currently on the calendar.
3. Show a confirmation screen listing **every proposed change in plain language**, e.g. *"Moving Write SMHS volleyball block from Tuesday 9am to Thursday 9am to make room for Payroll, which is due Wednesday."*
4. **Nothing is written until approved.**

Recurring tasks never appear in the move list. Every diff line is a complete sentence naming the task and the reason.

## 12. Overflow

When the backlog will not fit, place what fits and show a **Didn't Fit** list below the week. Nothing is silently dropped and nothing is pushed to next week without being seen.

## 13. Closing out a block

Three outcomes. No partial-credit state.

- **Completed** — record actual blocks used, feed the estimator, done.
- **Unfinished** — prompt for how much more time, answered in blocks (1–4). The task returns to the backlog at the reduced estimate and is re-placed on the next run.
- **Swap** — open the full task list, pick a different task, it takes over the block. The displaced task returns to the backlog untouched.

## 14. Recurring tasks

- Repeat monthly on a date, weekly on a weekday, and so on.
- Each recurring task has a lead-time reminder, **default one day before**, delivered as a Telegram message. Rent on the 31st means a ping on the 30th.
- Auto-placed first, before any backlog task is considered.

## 15. Delegation

- Delegate items never claim calendar time of their own.
- What gets scheduled is a single **delegation block** — a recurring 30 minute slot. During it, the user opens the Delegate screen and hands everything off. One block, however many items are in it.
- The Delegate screen groups by person so a single coach's items can be pulled up when that coach is standing there.

## 16. Duration estimation

The app **guesses** block count. It does not ask.

- On task creation, Claude estimates block count from the task text plus prior history. The estimate is shown and is editable in one tap.
- On close-out, record actual versus estimate.
- Feed the most recent **30–50 completions** (title, category, estimated blocks, actual blocks) into the estimator prompt as examples.
- Cold-start defaults: Deep Focus **2** blocks, admin categories **1** block.

## 17. Telegram capture

1. Voice note or text message hits the bot.
2. Voice is transcribed (Whisper or equivalent).
3. Claude parses it into: title, category, location, due date if mentioned, financial impact if inferable, estimated blocks, and assignee if it is a delegation.
4. The bot replies with a one-line confirmation plus quick buttons to change category, location, or block estimate.
5. The task lands unscheduled.

Multiple tasks in one voice note split into separate tasks. **Capture only** — completing and closing out blocks happens in the app.

Telegram is used for exactly two things: capturing tasks, and recurring lead-time reminders.

## 18. Things to deliberately not build

- No dashboard, no charts, no stats page.
- No auto-scheduling on a timer or on task creation. The button is the only trigger.
- No partial-credit close-out state.
- No squeezing work into sub-30-minute gaps.
- No writing to the calendar without an approved diff.
