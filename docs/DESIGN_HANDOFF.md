# Handoff: Odyssey Task Scheduler (mobile)

## Overview

A personal task capture and auto-scheduling app for Desean Berger (Odyssey Performance). Two halves:

1. **Capture** — tasks arrive by voice or text through a Telegram bot, get parsed by Claude into structured task data, and land in the task list unscheduled.
2. **Schedule** — a manual **Schedule My Week** button lays the task list into the open gaps in the real Google Calendar. Nothing is written until the user approves a diff. Nothing moves without the button.

This bundle covers the **mobile (iOS) UI** for the whole app: 17 designed screens across Today, Week, All Tasks, Delegate, the week-template settings, the confirmation/diff, block close-out, task detail, and the Telegram capture reply — in both a dark and a light view.

## About the design files

`Odyssey Task Scheduler.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior. It is **not production code to copy**. The job is to recreate these designs in the target codebase (per the product spec: **Next.js + TailwindCSS + Supabase**, deployed on Vercel) using that stack's established patterns.

The file is a "Design Component": one HTML document that renders a canvas board of phone-sized screen frames. Open it in a browser to see all screens at once. It needs `support.js` (included) sitting beside it. Two screens are interactive — see *Interactions* below.

**Do not port the HTML structure.** Port the **layout, spacing, type, color, and copy**, which are documented exhaustively below and are exact.

## Fidelity

**High fidelity.** Colors, typography, spacing, and copy are final and should be reproduced exactly. Every hex value, font size, weight, letter-spacing, and border width in this README is the intended value, not an approximation. The only intentionally loose parts: the SVG icons (Lucide equivalents are fine, 1.5px stroke) and the iOS status bar (use the platform's).

---

## Design tokens

### Color — dark view (default)

| Token | Value | Use |
|---|---|---|
| `bg` | `#000000` | Page background, true black |
| `panel` | `#0A0A0A` | Raised cards / rows on the black |
| `panel-inert` | `#050505` | Locked calendar events, disabled surfaces |
| `hairline` | `#1C1C1C` | Dividers, default 1px borders |
| `hairline-2` | `#232323` | Border on locked blocks inside the week grid |
| `text` | `#FFFFFF` | Headlines, task titles |
| `text-secondary` | `#A0A0A0` | Sub-labels, meta rows, captions |
| `text-faded` | `#5A5A5A` | Struck-through values, muted notes, inactive tabs |
| `gold` | `#FFD700` | **The one accent.** One or two moments per screen. |
| `card-navy` | `#0D1A2B` | Discrete-object card fill (active block, conflict, sheet insets) |
| `antique-gold` | `#D3AF37` | Pairs with navy — borders and text on navy cards, never on black |

### Color — light view

| Token | Value | Use |
|---|---|---|
| `bg` | `#F4F4F2` | Page background (paper, not white) |
| `panel` | `#FFFFFF` | Cards, rows, tab bar |
| `panel-inert` | `#EDEDE9` | Locked calendar events |
| `hairline` | `#D8D8D2` | Dividers, 1px borders |
| `text` | `#0A0A0A` | Headlines, task titles |
| `text-secondary` | `#5A5A5A` | Meta rows |
| `text-faded` | `#A0A0A0` | Muted notes, inactive tabs, locked event text |
| `gold` | `#FFD700` | Still the accent — as a **fill** with `#000` text (a gold button). Never gold text on white. |
| `card-navy` | `#0D1A2B` | Inverts to mean **active/live** on light |

**Rule:** gold is a spotlight, not a highlighter. One or two gold moments per view. If everything is gold, nothing is.

### Category colors

Category color is confined to a **3px left rail** on the card plus its own **label text**. Never a fill, never the title color. Deep Focus is the only category that wears the accent gold.

| Category | Rail (both views) | Label — dark | Label — light | Block size | Schedules? |
|---|---|---|---|---|---|
| Deep Focus | `#FFD700` | `#FFD700` | `#7A6100` | 45 min | Yes |
| High Priority Admin | `#C2453F` | `#C2453F` | `#A3352F` | 30 min | Yes |
| Low Priority Admin | `#6E7787` | `#6E7787` | `#4A5262` | 30 min | Yes |
| Personal | `#4E8C7D` | `#4E8C7D` | `#2F6A5C` | 30 min | Yes |
| Delegate | `#D3AF37` | `#D3AF37` | `#7A5F12` | none | No — list only |

Other semantic colors: `#4E8C7D` also marks "new placement" and "handed off"; `#C2453F` marks urgent, conflict, and destructive (delete).

### Typography

Loaded from Google Fonts: `Bebas+Neue`, `Rajdhani:wght@500;600;700`, `Roboto+Mono:wght@400;500`.

| Role | Family | Spec | Use |
|---|---|---|---|
| Screen title | Bebas Neue 400 | `34px / 0.9`, `ls .03em`, uppercase | `TODAY`, `ALL TASKS`, `BACKLOG`, `DELEGATE` |
| Screen title (large) | Bebas Neue 400 | `40px / 0.9`, `ls .03em` | `TODAY` on 1a |
| Sheet / detail title | Bebas Neue 400 | `26px / 0.95–0.98`, `ls .03em` | `PAYROLL — AUG 16–31` |
| Numerals | Bebas Neue 400 | `22px–30px / 1` | Block counts, stepper value, priority index |
| Day / person name | Bebas Neue 400 | `17–19px`, `ls .06em` | `MON`, `ANNIE` |
| Status bar clock | Bebas Neue 400 | `15px`, `ls .06em` | `11:42` |
| Eyebrow / small label | Rajdhani 700 | `9px`, `ls .25em`, uppercase | `THU · SEP 03`, `UNSCHEDULED · 17` |
| Section label | Rajdhani 700 | `10px`, `ls .22em`, uppercase | `DEEP FOCUS · 5`, `MOVES · 3` |
| Category label | Rajdhani 700 | `9px`, `ls .20–.22em`, uppercase | `HIGH PRIORITY ADMIN` |
| Tab label | Rajdhani 700 | `9px`, `ls .18em`, uppercase | `TODAY`, `WEEK` |
| Button label | Rajdhani 700 | `11–12px`, `ls .16–.20em`, uppercase | `SCHEDULE MY WEEK` |
| Chip label | Rajdhani 700 | `10–11px`, `ls .14em`, uppercase | `CATEGORY`, `30 MIN` |
| Task title | Rajdhani 600 | `15–16px` | `Payroll — Aug 16–31` |
| Body / prose | Rajdhani 600 | `14–15px / 1.45–1.5` | Diff sentences, helper copy |
| Data / meta | Roboto Mono 500 | `9–11px`, `ls .04em`, uppercase | `1 BLOCK · HOME · IMPACT 5` |
| Time gutter | Roboto Mono 500 | `10px` | `08:00` |

Casing: Bebas and Rajdhani-700 labels are **always uppercase**. Task titles and prose are sentence case. Times and data are mono, uppercase, `·`-separated, en-dash for ranges (`11:45 – 12:15`, `30 – 60 MIN`). No emoji, ever.

### Spacing, radii, borders, motion

- 8pt scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Screen horizontal padding: **20px** (All Tasks) or **22px** (all other screens).
- Card inner padding: `9–11px` vertical, `11–12px` horizontal. Gap between stacked cards: `6px`. Gap between sections: `14–16px`.
- **Max border radius is 4px.** Cards and buttons are `2px`. Circles only for avatars and status dots.
- Borders: `1px` hairline default; `2px` for a plaque emphasis (the close-out sheet's top edge); `3px` for the category rail; `4px` reserved for a gold status strip.
- **No blurred shadows.** Elevation is a border shift or a hard `0 2px 0 rgba(0,0,0,0.6)`.
- Motion: `200ms cubic-bezier(.2,.7,.2,1)` default; `320ms cubic-bezier(.9,0,.1,1)` for sheet/accordion snap. Never bounce, spring, or elastic.
- Press state: gold → `#D4AF00`, element translates down 1px, no scale.
- Overlay scrim: `rgba(0,0,0,0.82)` + 18px backdrop blur.

### Shared screen chrome

Every screen is **390 × 844** (iPhone logical). Structure, top to bottom:

1. **Status bar** — 44px tall, `0 22px` padding, clock left, indicators right.
2. **Header** — `6px 20–22px 12–14px`; eyebrow (Rajdhani 700 / 9px / .25em) stacked above the Bebas title; optional right-aligned metric or icon button.
3. **Content** — `flex: 1`, scrolls, `0 20–22px` padding.
4. **Optional action bar** — `12px 22px`, `border-top: 1px hairline`.
5. **Tab bar** — `border-top: 1px hairline`, padding `9px 0 18px`, four equal flex items, each a 19px 1.5px-stroke icon above a 9px/.18em label. Active = gold (dark) / `#0A0A0A` (light); inactive = `#5A5A5A` (dark) / `#A0A0A0` (light).

**Tabs: Today · Week · All Tasks · Delegate.** There is no separate Backlog tab — the backlog is All Tasks with an "unscheduled" filter.

Minimum tap target 44px. The star-rating row and tab items are the two places to watch.

---

## Screens

IDs match the badges on the design board.

### 2a / 2b — All Tasks (dark / light) — *the primary working view*

**Purpose.** The running list the user opens when they sit down with a short window and want to see everything at once and pick something off. This is the app's most-used screen.

**Layout.** Header (`ALL TASKS`, eyebrow = open count e.g. `11 OPEN`, search icon right) → sort chip row → sort explanation line → scrolling list → tab bar.

**Sort chips.** Three equal-width chips in a `6px`-gap row: `CATEGORY`, `DUE DATE`, `STARS`. Padding `9px 0`, radius 2px, Rajdhani 700 / 10px / .14em.
- Selected: dark = `#FFD700` fill + `#000` text; light = `#0A0A0A` fill + `#FFF` text.
- Unselected: 1px hairline border, `#A0A0A0` (dark) / `#5A5A5A` (light) text.

**Sort explanation** (Roboto Mono 500 / 9px / .06em, `#5A5A5A` dark, `#A0A0A0` light) — changes with the sort:
- `CATEGORY` → `GROUPED BY CATEGORY · DEEP FOCUS OUTRANKS ADMIN AT EQUAL SCORES`
- `DUE DATE` → `SORTED BY DUE DATE · ANYTHING INSIDE 48H READS URGENT`
- `STARS` → `SORTED BY YOUR STAR RATING · TAP ANY STAR TO RE-RATE`

**Sort behavior.**
- **CATEGORY** — grouped, with a section header per category in the fixed order Deep Focus → High Priority Admin → Low Priority Admin → Personal → Delegate. Within a group, sort by due date ascending, no-date last. Delegate's header reads `DELEGATE · NOT SCHEDULED`. Header = category label color, then a 1px hairline filling the row, then the group count in mono.
- **DUE DATE** — flat, one header `SOONEST FIRST · NO DATE LAST`, ascending, nulls last.
- **STARS** — flat, one header `MOST IMPORTANT FIRST`, importance descending, due date as tiebreak.

**Task row.** `display:flex`, panel background, 1px hairline border, radius 2px, `6px` bottom margin.
- 3px full-height category rail on the left edge.
- Body `padding: 9px 11px`, `flex-direction: column`, `gap: 6px`:
  - Row 1: title (Rajdhani 600 / 15px, `#FFF` / `#0A0A0A`) — left; block count (Roboto Mono 500 / 9px, `#5A5A5A` / `#A0A0A0`) — right. Values: `1 BLOCK`, `2 BLOCKS`, `3 BLOCKS`, or `HANDOFF` for Delegate items.
  - Row 2: meta line (Roboto Mono 500 / 9px, `#A0A0A0` / `#5A5A5A`) — `CATEGORY · LOCATION · DUE LABEL`, e.g. `HIGH PRIORITY ADMIN · HOME · DUE WED SEP 02` — left; the star rating — right.

**Star rating.** Five 13×13 star glyphs, `3px` gap, each independently tappable. Tapping star *n* sets importance to *n* (1–5). Filled: `fill` and `stroke` = `#FFD700` (dark) / `#D3AF37` (light). Empty: `fill: none`, `stroke` = `#2A2A2A` (dark) / `#D8D8D2` (light). Stroke width 1.5. **Wrap each star in a ≥44px tall hit area** even though the glyph is 13px.

This star value **is** the task's `financial_impact` field (1–5) — see *Priority* in `SCHEDULER_RULES.md`. It is not a second, parallel rating.

### 3a / 3b — Settings · Week Template (dark / light) — *the availability editor*

**Purpose.** Tell the scheduler when the week is actually available. Without this, "no working hours, 24/7" means Deep Focus can land at 04:00. Claude collects the template once during setup by asking; this screen is where it lives afterwards, permanently editable.

**Reached from** Settings (back chevron + `SETTINGS` eyebrow at the top). Not a tab.

**Layout.** Header (`WEEK TEMPLATE`, Bebas 32px) → explainer line → capacity readout → the day list → caps and resets rows → save bar.

**Explainer** (Rajdhani 600 / 13px / 1.45, `#A0A0A0` / `#5A5A5A`): *"The scheduler only places work inside these windows. Everything outside them stays empty, whatever the calendar says."*

**Capacity readout.** Two cells in a 1px hairline box (`margin: 0 22px`), split by a 1px divider. Left: available time (Bebas 20px, **gold** on dark / `#0A0A0A` on light) over `AVAILABLE TIME`. Right: block count over `BEFORE RESETS`. Both recompute live as windows are edited — this is the one gold moment on the screen, because capacity is the number that matters.

**Day row.** `13px 0`, 1px top hairline, `12px` gap: day name (Bebas 17px / .04em — white when open, `#5A5A5A` when collapsed) · window count in mono · open time in mono (`7H 30M OPEN`) · chevron (down when open, right when closed). Tapping toggles the day open; one day open at a time.

**Window row** (only under the open day). Indented 44px, `7px 0`, `10px` gap: the time range (Roboto Mono 500 / 11px, 92px fixed width, primary text color) · the **allowance chip** · spacer · duration in mono · a 14px delete icon.

**Allowance chip.** `5px 9px`, radius 2px, 1px border, Rajdhani 700 / 9px / .16em. Border and text share one color; there is no fill. Tapping cycles `ANY → DEEP FOCUS → ADMIN ONLY → NO WORK`.

| Allowance | Dark | Light | Meaning |
|---|---|---|---|
| ANY | `#A0A0A0` | `#5A5A5A` | Any category may land here |
| DEEP FOCUS | `#FFD700` | `#7A6100` | Deep Focus only |
| ADMIN ONLY | `#6E7787` | `#4A5262` | 30-min categories only, never Deep Focus |
| NO WORK | `#C2453F` | `#A3352F` | Closed — contributes 0 to capacity, duration shows `—` |

`NO WORK` keeps the window in the list rather than deleting it, so a seasonal change can be toggled back without retyping times.

**ADD WINDOW** row closes each open day: a 14px gold `+` and the label in gold (dark) / `#7A6100` (light), indented 44px.

**Caps and resets.** Two hairline-separated rows below the day list: `DEEP FOCUS CAP` → `3 PER WEEKDAY · WEEKEND UNCAPPED` (mono); `RESET LENGTH` → a two-segment toggle `10 MIN` / `15 MIN`, active segment gold fill + black text.

**Save bar.** A mono caveat above the button — `CHANGES APPLY ON THE NEXT SCHEDULE MY WEEK · PLACED BLOCKS ARE NOT MOVED` — then the gold **SAVE TEMPLATE** button. That caveat is load-bearing: editing the template must never silently reshuffle a week that is already on the calendar.

**Data.** Recurring pattern in `availability_windows`; one-off exceptions (travel, closed gym, holiday) in `availability_overrides` so a single odd week never corrupts the template. See `schema.sql` and `SCHEDULER_RULES.md` §3.

### 1a / 2c — Today (dark / light)

**Purpose.** The stripped-down default: what is happening now, what is next, and the three ways to close out the live block.

**Layout.** Header (eyebrow `THU · SEP 03`, title `TODAY` at 40px; right column = block count in Bebas 22px above `BLOCKS LEFT`) → urgent strip → vertical timeline → close-out bar → tab bar.

**Urgent strip.** Only shown for urgent tasks that are **not yet placed** on the calendar. Panel card, 1px hairline, 3px `#C2453F` left rail, `padding: 9px 12px`, `margin: 0 22px 14px`, row layout with `10px` gap: `URGENT · UNPLACED` label (Rajdhani 700 / 9px / .22em, `#C2453F` / `#A3352F`) · task title (Rajdhani 600 / 13px, flex 1) · `PLACE IT` action (Rajdhani 700 / 9px / .16em, gold on dark, `#7A6100` on light). If nothing urgent is unplaced, the strip is not rendered.

**Timeline row.** `display:flex`, `10px` gap. Left gutter 36px, right-aligned, Roboto Mono 500 / 10px, `#5A5A5A` — gold/`#0A0A0A` for the active row's time. Right side is the block card, `flex: 1`.

Three card states:
- **Locked calendar event** — `#050505` / `#EDEDE9` fill, **1px dashed** hairline, all text `#5A5A5A` / `#A0A0A0`. Label `LOCKED · CALENDAR` + duration; title Rajdhani 600 / 14px. Visibly inert — not tappable.
- **Scheduled block** — panel fill, 1px hairline, 3px category rail. Category label + block count row; title Rajdhani 600 / 15px (add `line-through` with a `#5A5A5A` decoration color when complete); mono meta `10:00 – 11:30 · HOME · DONE`.
- **Active block** — `#0D1A2B` fill, **1px `#D3AF37` border**, 3px category rail. Same anatomy but title at 16px in white, right-hand marker reads `ACTIVE` in `#D3AF37`. This navy plaque is what makes "right now" findable at a glance, and it is why the light view keeps navy: on paper it becomes the darkest thing on screen.

**Reset gap.** Between tasks only, never inside one. Rendered as a 14px-tall row indented 46px: a 1px dashed rule (`repeating-linear-gradient(90deg, hairline 0 5px, transparent 5px 11px)`) then the label `RESET · 15` (Rajdhani 700 / 8px / .25em, `#5A5A5A` / `#A0A0A0`).

**Now marker.** A row with `8px` gap: a gold chip `NOW 11:42` (Rajdhani 700 / 9px / .2em, `#FFD700` fill, `#000` text, `2px 5px` padding, radius 1px) followed by a 1px full-width rule — `#FFD700` on dark, `#D3AF37` on light.

**Close-out bar.** Rendered **only when a block is live or has just ended.** Column, `9px` gap, `12px 22px` padding, 1px top hairline:
- Scope label: `CLOSING · PAYROLL · 11:45 – 12:15` (Rajdhani 700 / 9px / .22em, `#5A5A5A` / `#A0A0A0`).
- Three buttons in an `8px`-gap row, each `flex: 1`, `padding: 11px 0`, radius 2px: **COMPLETED** (gold fill, black text) · **MORE TIME** (1px hairline, secondary text) · **SWAP** (same).

### 1b — Today, "what can I tackle" (alternate treatment, interactive)

A time-window picker rather than a timeline: chip row `15 MIN / 30 MIN / 45 MIN / 90 MIN` filters the task list to what fits the gap. Kept in the bundle as a reference for the fit-filter idea; **2a is the shipped answer to this need.** Note the 30-minute minimum: a 15-minute window legitimately fits nothing, and the screen says so rather than faking a result. If this pattern is built, that empty state must survive.

### 1c — Week, 7-column grid

**Purpose.** Read the week's shape at a glance and fire the scheduler.

**Layout.** Header (`THE WEEK`, eyebrow `WEEK OF SEP 01`; right column shows `DF 3/3 TODAY` in mono over `CAP ACTIVE MON–FRI`) → full-width gold **SCHEDULE MY WEEK** button (`padding: 13px 0`, Rajdhani 700 / 12px / .20em, black text) → weekday header row → the grid → Didn't Fit list → tab bar.

**Grid.** 392px tall. 26px time gutter on the left showing `06 · 09 · 12 · 15 · 18 · 21` distributed top to bottom (Roboto Mono 500 / 9px). The grid body is a `repeat(7, 1fr)` CSS grid with 1px `#111` column separators, 1px hairline outer border, radius 2px, and horizontal hour rules via `repeating-linear-gradient(180deg, transparent 0 64px, #111 64px 65px)`. Blocks are absolutely positioned bars inset `2px` left/right with a 3px category rail and no text — 30 min ≈ 21px tall, 45 min ≈ 32px, locked events are `#050505` with a 1px dashed `#232323` border. The current day column gets a `#060606` wash and a 1px gold "now" line.

Treat this as a **read-only overview**. It is deliberately too dense to edit at 50px per column; editing happens in the day view.

**Didn't Fit.** Section label `DIDN'T FIT · 3` in `#C2453F` with the hint `TAP TO PUSH TO NEXT WEEK`, then compact rows: title left, `3 BLK` right, category rail. Urgent tasks may never appear here (see rules). Because this list sits below a 392px grid it is mostly below the fold — surface the count on the Schedule button too, or move the list into its own sheet.

### 1d — Week, day rail + load meters *(recommended as the operable week view)*

**Purpose.** Judge the week's load and drill into a day.

Seven rows, one per weekday, `11px 22px` padding, 1px hairline between. Each row: day name (Bebas 17px, `#5A5A5A`) · a 12px-tall load meter · a mono cap readout (`DF 2/3`). The meter is a flex row of `2px`-gap segments proportional to the day's committed time — `#232323` for locked calendar time, category colors for scheduled blocks, `#0A0A0A` for the remaining open space.

The selected day is a `#0D1A2B` row with `#D3AF37` top and bottom borders, larger type (Bebas 19px, white), a 14px meter, and its cap readout in `#D3AF37`. Weekend rows read `DF 4 · UNCAPPED` in gold when the weekday cap does not apply.

Below the rail: the selected day's agenda — label `THU · SEP 03 — 6 BLOCKS · 2 RESETS`, then compact rows of `time · title · tag`, where the tag is `URGENT` (`#C2453F`), a location (`GYM`), or `LOCKED` on a dashed inert row. Then the gold **SCHEDULE MY WEEK** button.

### 1g — Confirmation / diff, plain language *(recommended)*

**Purpose.** Approve or discard everything the scheduler wants to change. **Nothing is written to Google Calendar until this is approved.**

**Layout.** Header: eyebrow `NOTHING WRITTEN YET`, title `7 CHANGES` (Bebas 30px), close X right. Then, in order:

1. **Conflict card** (only when an urgent task cannot be placed) — `#0D1A2B` fill, 1px `#D3AF37` border, `12px` padding, `9px` gap. Label `CONFLICT · 1 URGENT ITEM HAS NOWHERE TO GO` in `#C2453F`. Sentence (Rajdhani 600 / 15px / 1.45, `#FFF`) naming the item and what it would bump, with both names emphasized in `#D3AF37`. Two buttons: `BUMP IT` (1px `#D3AF37`) and `LEAVE AS IS` (1px hairline).
2. **MOVES · n** — section label, then one card per move: panel fill, 1px hairline, `11px 12px`, an `11px` gap, a 16px gold arrow icon top-aligned, then a full sentence in Rajdhani 600 / 14px / 1.5 `#A0A0A0` with task names in white: *"Moving **Write SMHS volleyball block** from Tue 09:00 to Thu 09:00 to make room for **Payroll**, due Wednesday."*
3. **NEW PLACEMENTS · n** — same card, `#4E8C7D` plus icon: *"Placing **Payroll** Wed 11:45, 30 min, Home."* Where a placement is location-driven, say so: *"…Fri 14:30 — you are at the gym from 14:00."*
4. **Recurring footnote** — dashed inert card, mono `#5A5A5A`: `2 RECURRING TASKS PLACED FIRST — NOT LISTED, NEVER MOVED.`

**Action bar.** `DISCARD` (flex 1, 1px hairline) and `WRITE 7 CHANGES` (flex 1.6, gold fill, black text) — the count is live.

Every line must be a complete, plain-English sentence naming the task and the reason. No diff syntax, no jargon.

### 1h — Confirmation / diff, before/after strips (alternate)

Per changed day: the day label, a `NOW` meter strip, a `NEXT` meter strip in `#D3AF37`, and a mono summary of the delta (`− WRITE SMHS BLOCK OUT · + PAYROLL 11:45`). Strips use the same segment vocabulary as 1d, with dashed `#C2453F` outlines marking removals. Day labels annotate the reason (`THU · SEP 03 — DEEP FOCUS CAP REACHED`, `SAT · SEP 05 — UNCAPPED`). A dashed legend card sits at the bottom. Actions: `READ AS LIST` (switches to 1g) and `APPROVE LAYOUT`.

Ship 1g first; 1h is a good secondary toggle from the same screen.

### 1i — Delegate

**Purpose.** Run the handoff during the recurring 30-minute delegation block. Grouped by person so a single coach's items can be pulled up when they walk past.

Header eyebrow states the block: `HANDOFF BLOCK · THU 13:00 – 13:30`; title `DELEGATE`.

Per person: a header row with a 26px circular avatar (1px `#D3AF37` border, initial in Bebas 13px `#D3AF37`), the name in Bebas 19px / .06em, a 1px hairline filling the row, and the count in mono. Then item rows — panel fill, 1px hairline, `10px 12px`, `11px` gap: a 15px square checkbox (1px `#5A5A5A`), the item title (Rajdhani 600 / 14px, flex 1), and a mono date or `—`. Handed-off items drop to `opacity: .5`, swap the checkbox for a `#4E8C7D` check, strike the title, and read `HANDED`.

An `UNASSIGNED` group closes the list — dashed border rows with a gold `+` to assign an owner. Bottom action: gold **MARK 5 HANDED OFF**.

Delegate items never claim calendar time of their own; only the recurring delegation block does.

### 1j — Block close-out sheet (interactive)

**Purpose.** Close the active block. Three outcomes, no partial credit.

The underlying screen dims to `opacity: .35` behind a `rgba(0,0,0,0.82)` + 18px blur scrim. The sheet is bottom-anchored, `#0A0A0A` fill, **2px gold top border**, `20px 22px 26px` padding, `16px` gap.

Header: eyebrow `BLOCK ENDING · 11:45 – 12:15 · EST 1 BLOCK`, then the task name in Bebas 26px.

Three option rows (`8px` gap, `13px 14px` padding, radius 2px). Unselected: `#000` fill, 1px hairline, `#A0A0A0` text. Selected: `#0D1A2B` fill, 1px `#D3AF37`, white text. Each row is a label (Rajdhani 700 / 12px / .18em) over a sub-line (Rajdhani 500 / 11px, `#A0A0A0`), with a mono marker right:

| Option | Sub-line | Marker |
|---|---|---|
| COMPLETED | Records 1 block actual. Feeds the estimator. | `EST 1 / ACT 1` |
| UNFINISHED | Back to backlog at a reduced estimate. | `+ TIME` |
| SWAP | Another task takes this block. | `PICK` |

Selecting **UNFINISHED** reveals a stepper inset (`#0D1A2B`, 1px `#D3AF37`, `14px` padding): label `HOW MUCH MORE TIME?`, a `–` button (40×40, 1px hairline) / value (Bebas 30px block count over a mono minute readout) / `+` button (40×40, 1px gold), and the note *"Returns to the backlog at the reduced estimate and gets re-placed on the next run."* Range 1–4 blocks, 30 min each.

Selecting **SWAP** reveals a task picker inset with the same frame: label `WHAT TAKES THE BLOCK?`, compact task rows with category rails, and the note *"Payroll goes back to the backlog untouched."*

The gold confirm button's label follows the selection: `CLOSE BLOCK` / `RETURN TO BACKLOG` / `CONFIRM SWAP`.

### 1k — Task detail + edit

Header: back chevron, `TASK · #0412` centered, `#C2453F` delete icon right.

A `#0D1A2B` / 1px `#D3AF37` summary plaque opens the screen: urgency label `URGENT · DUE IN 9H` (`#C2453F`), the title in Bebas 26px, and the capture provenance in Rajdhani 500 / 13px / 1.5 `#A0A0A0` — *"Captured by voice, 08:12. '…transcript…'"*. Keep the transcript: it is how the user checks what Claude heard.

Then a hairline-separated list of `14px 0` rows, label left (Rajdhani 700 / 10px / .22em `#5A5A5A`), control right:

| Row | Control |
|---|---|
| CATEGORY | color dot + name + chevron → picker |
| LOCATION | two-segment toggle, `HOME` / `GYM`, active segment = gold fill + black text, `6px 14px` |
| BLOCKS | mono `EST 30 MIN` + three 22px squares, filled in the category color up to the estimate |
| DUE | mono `WED SEP 02 · 17:00` |
| FINANCIAL IMPACT | five 14×20px bars in `#D3AF37` — **the same value as the stars on 2a** |
| RECURRING | 42×22 switch, 1px hairline, 16px knob |

A closing row shows the estimator's own history: `ESTIMATOR HISTORY` · `LAST 3 PAYROLLS · EST 1 / ACT 1.3`.

Action bar: `DELEGATE IT` (1px hairline) and `SAVE` (flex 1.4, gold).

### 1l — Telegram capture confirmation

A reference for the bot's reply formatting inside Telegram (frame background `#0E1621`, outgoing bubble `#12283C`, radius 4px — Telegram's, not ours).

The user's voice note renders with a mic icon, a bar waveform, a `0:21` duration, and the transcript. The bot replies with a single dark card (`#000`, 1px `#1C1C1C`) containing:
- `2 TASKS CAPTURED` label.
- One parsed block per task: the title (Rajdhani 600 / 15px) over a mono spec line — `HI-PRI ADMIN · HOME · 1 BLOCK · DUE WED · IMPACT 5` — indented behind a 3px category rail.
- Per task, a row of quick-edit buttons: `CATEGORY`, `LOCATION`, `BLOCKS`, and `DELEGATE →` (gold border + gold text when it is the suggested action).
- Closing line: *"Both sit in the backlog. Press Schedule My Week in the app to place them."*

A second bubble shows the recurring lead-time reminder format: 3px `#D3AF37` left rail, label `LEAD-TIME REMINDER`, then *"Rent is due tomorrow, Aug 31. Recurring, already placed at 07:00."*

Capture only. Completing and closing out blocks happens in the app, never over Telegram.

---

## Interactions & behavior

Implemented live in the prototype (open the file and click):

- **2a / 2b sort chips** — switch sort mode; the list regroups and the explanation line changes. State is shared between the dark and light frames, so both update together.
- **2a / 2b stars** — tapping star *n* sets that task's importance to *n* and, in STARS sort, re-sorts the list immediately.
- **1j option rows** — selecting an option reveals its inset (stepper or swap picker) and rewrites the confirm button's label. The stepper `+`/`–` clamp to 1–4 blocks.
- **3a / 3b day rows and allowance chips** — tapping a day expands it; tapping an allowance chip cycles through the four values, and the capacity readout at the top recomputes immediately. State is shared between the dark and light frames.
- **1b window chips** — filter the fit list; the 15-minute case shows its empty state.

Everything else is a static state. Specified but not prototyped:

- Tab navigation between the four views.
- Tapping a task row anywhere → task detail (1k). Tapping a locked calendar event → nothing.
- `SCHEDULE MY WEEK` → compute, then push the confirmation screen (1g). Never write on the way in.
- `PLACE IT` on the urgent strip → run the scheduler for that one task and show its diff.
- Dropping a task into a reset gap → warning dialog *"You're overriding your 15 minute reset block."* with a proceed action. It warns; it does not block.
- Overflow rows in Didn't Fit → tap to push to next week.
- Transitions: 200ms `cubic-bezier(.2,.7,.2,1)`; the close-out sheet and the diff screen enter at 320ms `cubic-bezier(.9,0,.1,1)`.
- Light/dark is a user setting, applied app-wide. No auto-switching in the design; follow the OS setting by default if that is cheap.

## State

Client state the UI needs:

| State | Type | Notes |
|---|---|---|
| `theme` | `'dark' \| 'light'` | Persisted. |
| `openDay` | weekday \| null | Week template — which day is expanded. One at a time. |
| `windowAllowances` | map | Week template — pending edits before save. |
| `sortMode` | `'category' \| 'due' \| 'stars'` | All Tasks. Persisted — it is a habit, not a session choice. |
| `locationFilter` | `'all' \| 'home' \| 'gym'` | All Tasks (chips exist in the 1f treatment). |
| `activeBlockId` | id \| null | Drives whether the close-out bar renders. |
| `closeOutChoice` | `'completed' \| 'unfinished' \| 'swap'` | Sheet-local. |
| `moreBlocks` | `1–4` | Sheet-local, 30 min per block. |
| `selectedDay` | date | Week view. |
| `pendingDiff` | diff object \| null | Held client-side until approved; never auto-written. |

Data fetching: the week's Google Calendar events (read first, always), the task list, and — for the estimator — the most recent 30–50 completions.

## Assets

- **Fonts** — Bebas Neue, Rajdhani, Roboto Mono, all Google Fonts. No licensed files needed.
- **Icons** — Lucide (1.5px stroke, sharp corners, never filled) at 14/16/20/24. The prototype hand-draws equivalents inline; use the real Lucide set. Icon color inherits from surrounding text; gold only when the icon *is* the accent.
- **Odyssey logo** — `assets/logo-horizontal-light.png` and `assets/logo-stacked.png` are copied into this bundle. Not used on any screen (a personal tool doesn't need to brand itself at the user) — available for the app icon, splash, and login.
- **No illustration, no photography, no emoji.**

## Files in this bundle

| File | What it is |
|---|---|
| `Odyssey Task Scheduler.dc.html` | The design board — all 17 screens. Open in a browser. |
| `support.js` | Runtime the board needs. Must sit beside the HTML. |
| `SCHEDULER_RULES.md` | The scheduling algorithm: block grid, resets, caps, location matching, priority, re-run diff, overflow, estimation. **Read this before writing the scheduler.** |
| `schema.sql` | Supabase schema — tables, enums, indexes. |
| `assets/` | Odyssey logo files. |

## Build order

Do not build capture (Telegram, voice, the estimation loop) until scheduling works. A scheduler that produces a bad week is useless no matter how nice it is to talk to.

1. Supabase schema + a bare Next.js app with **All Tasks** (2a). Manual task entry only.
2. **Week template** (3a) + `scheduler_settings`. Do this before the scheduler — it is the constraint the scheduler is written against, and retrofitting availability later means rewriting placement.
3. Google Calendar read. Render the week with its existing walls (1d, then 1c).
4. The scheduler + calendar write: window allowances, block grid, reset gaps, Deep Focus cap, location matching. Generate a clean week from a hand-entered list.
5. Re-run diff, confirmation screen (1g), Didn't Fit list.
6. Today (1a) + block close-out (1j).
7. Recurring tasks and lead-time reminders.
8. Delegate list (1i) and the delegation block.
9. Telegram bot, text capture (1l).
10. Voice transcription.
11. The estimation learning loop.

The setup conversation that collects the week template is a convenience on top of step 2, not a substitute for the editor. Build the editor; the asking is easy afterwards.
