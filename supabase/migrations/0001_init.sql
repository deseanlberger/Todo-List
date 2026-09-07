-- Odyssey Task Scheduler — Supabase schema
-- Single-user app (Desean). user_id columns are included anyway so auth/RLS
-- can be switched on without a migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type task_category as enum (
  'deep_focus',
  'high_priority_admin',
  'low_priority_admin',
  'personal',
  'delegate'
);

create type task_location as enum ('gym', 'home');

create type task_status as enum ('backlog', 'scheduled', 'done');

-- What may be placed inside a week-template window.
create type window_allowance as enum ('any', 'deep_focus', 'admin_only', 'no_work');

-- ---------------------------------------------------------------- tasks

create table tasks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,

  title               text not null,
  notes               text,

  category            task_category not null,
  location            task_location  not null default 'home',

  -- 1 block = 45 min for deep_focus, 30 min for everything else.
  estimated_blocks    smallint not null default 1 check (estimated_blocks between 1 and 8),
  actual_blocks       smallint          check (actual_blocks between 0 and 16),

  due_date            timestamptz,

  -- The 1-5 star rating on the All Tasks screen. One field, one editor.
  financial_impact    smallint not null default 1 check (financial_impact between 1 and 5),

  -- Delegate only. Free text so a new coach doesn't need a migration.
  assignee            text,
  handed_off_at       timestamptz,

  status              task_status not null default 'backlog',

  is_recurring        boolean not null default false,
  recurrence_rule     text,                  -- RRULE string
  reminder_lead_days  smallint not null default 1,

  -- Provenance: how the task arrived. Shown on task detail (screen 1k).
  capture_source      text,                  -- 'telegram_voice' | 'telegram_text' | 'manual'
  capture_transcript  text,

  created_at          timestamptz not null default now(),
  completed_at        timestamptz,

  constraint delegate_has_no_blocks
    check (category <> 'delegate' or estimated_blocks = 1),
  constraint assignee_only_for_delegate
    check (assignee is null or category = 'delegate')
);

create index tasks_open_idx     on tasks (user_id, status) where status <> 'done';
create index tasks_due_idx      on tasks (user_id, due_date) where due_date is not null;
create index tasks_category_idx on tasks (user_id, category);

-- Urgency is derived, never stored:
--   due_date is not null and due_date <= now() + interval '48 hours'
create view urgent_tasks as
  select * from tasks
  where status <> 'done'
    and due_date is not null
    and due_date <= now() + interval '48 hours';

-- ------------------------------------------------------- scheduled blocks

create table scheduled_blocks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,

  -- null when is_reset_gap = true (a reset belongs to no task)
  task_id        uuid references tasks (id) on delete cascade,

  start_time     timestamptz not null,
  end_time       timestamptz not null,

  is_reset_gap   boolean not null default false,

  -- The delegation block: a recurring 30-min slot owned by no single task.
  is_delegation  boolean not null default false,

  gcal_event_id  text,
  week_of        date not null,             -- Monday of the target week

  created_at     timestamptz not null default now(),

  constraint block_ends_after_start check (end_time > start_time),
  constraint reset_has_no_task
    check ((is_reset_gap = false and (task_id is not null or is_delegation)) or
           (is_reset_gap = true  and task_id is null))
);

create index blocks_week_idx  on scheduled_blocks (user_id, week_of);
create index blocks_start_idx on scheduled_blocks (user_id, start_time);
create index blocks_task_idx  on scheduled_blocks (task_id);

-- ------------------------------------------------------- week template
-- The recurring availability pattern. The scheduler may ONLY place work
-- inside these windows. Edited on screens 3a / 3b.

create table availability_windows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,

  weekday     smallint not null check (weekday between 0 and 6),  -- 0 = Monday
  start_time  time not null,
  end_time    time not null,
  allowance   window_allowance not null default 'any',

  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),

  constraint window_ends_after_start check (end_time > start_time)
);

create index windows_day_idx on availability_windows (user_id, weekday, start_time);

-- One-off exceptions (travel, closed gym, holiday) held apart from the
-- recurring pattern so a single odd week never corrupts the template.
create table availability_overrides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,

  on_date     date not null,
  start_time  time,                          -- null + null = the whole day is closed
  end_time    time,
  allowance   window_allowance not null default 'no_work',
  reason      text,

  created_at  timestamptz not null default now()
);

create index overrides_date_idx on availability_overrides (user_id, on_date);

-- ------------------------------------------------------- settings

create table scheduler_settings (
  user_id             uuid primary key,

  deep_focus_cap      smallint not null default 3 check (deep_focus_cap between 1 and 8),
  weekend_uncapped    boolean  not null default true,
  reset_minutes       smallint not null default 15 check (reset_minutes in (10, 15)),

  deep_focus_minutes  smallint not null default 45,
  standard_minutes    smallint not null default 30,

  gcal_event_prefix   text not null default '[ODY] ',
  theme               text not null default 'light' check (theme in ('dark', 'light')),
  default_sort        text not null default 'category'
                        check (default_sort in ('category', 'due', 'stars')),

  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------- estimation history
-- Feeds the estimator prompt. Read the most recent 30-50 rows as examples.

create table estimation_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,

  task_id           uuid references tasks (id) on delete set null,
  title             text not null,
  category          task_category not null,
  estimated_blocks  smallint not null,
  actual_blocks     smallint not null,

  completed_at      timestamptz not null default now()
);

create index estimation_recent_idx on estimation_history (user_id, completed_at desc);

-- ------------------------------------------------------- pending diffs
-- A computed layout awaiting approval. Nothing reaches Google Calendar
-- until the user approves the diff on screen 1g.

create table pending_schedules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,

  week_of      date not null,
  payload      jsonb not null,   -- { moves[], placements[], conflicts[], didnt_fit[] }

  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  discarded_at timestamptz
);

create index pending_week_idx on pending_schedules (user_id, week_of)
  where approved_at is null and discarded_at is null;

-- ------------------------------------------------------- seed
-- Desean's starting week template. Replace with whatever the setup
-- conversation collects; it is meant to be edited in the app afterwards.

insert into availability_windows (user_id, weekday, start_time, end_time, allowance, sort_order) values
  ('00000000-0000-0000-0000-000000000000', 0, '05:30', '08:00', 'any',        0),
  ('00000000-0000-0000-0000-000000000000', 0, '12:00', '14:00', 'any',        1),
  ('00000000-0000-0000-0000-000000000000', 0, '20:00', '22:00', 'admin_only', 2),
  ('00000000-0000-0000-0000-000000000000', 1, '05:30', '08:00', 'deep_focus', 0),
  ('00000000-0000-0000-0000-000000000000', 1, '12:00', '14:30', 'any',        1),
  ('00000000-0000-0000-0000-000000000000', 2, '05:30', '08:00', 'any',        0),
  ('00000000-0000-0000-0000-000000000000', 2, '11:00', '14:00', 'any',        1),
  ('00000000-0000-0000-0000-000000000000', 2, '20:00', '22:00', 'admin_only', 2),
  ('00000000-0000-0000-0000-000000000000', 3, '06:00', '08:30', 'deep_focus', 0),
  ('00000000-0000-0000-0000-000000000000', 3, '11:00', '15:00', 'any',        1),
  ('00000000-0000-0000-0000-000000000000', 3, '20:00', '22:00', 'admin_only', 2),
  ('00000000-0000-0000-0000-000000000000', 4, '05:30', '08:00', 'any',        0),
  ('00000000-0000-0000-0000-000000000000', 4, '12:00', '14:00', 'any',        1),
  ('00000000-0000-0000-0000-000000000000', 5, '07:00', '12:00', 'deep_focus', 0),
  ('00000000-0000-0000-0000-000000000000', 6, '08:00', '11:00', 'any',        0),
  ('00000000-0000-0000-0000-000000000000', 6, '19:00', '21:00', 'no_work',    1);
