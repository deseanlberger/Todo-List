-- Recurring commitments: the fixed, same-time-every-week things Desean
-- already does. Coaching a group, a standing meeting, a lift.
--
-- These are WALLS, not tasks. The scheduler may never place work over one.
-- They exist because the week template says when he is *free*, and Google
-- Calendar (when connected) says what is already booked — but neither lets
-- him type in "I coach Flight Academy every Tuesday 3 to 5" without a
-- calendar account. This table is that third input.

create table commitments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,

  title       text not null,

  weekday     smallint not null check (weekday between 0 and 6),  -- 0 = Monday
  start_time  time not null,
  end_time    time not null,

  -- Drives SCHEDULER_RULES §6. A gym commitment makes the minutes either
  -- side of it gym time, so a Home task may not land there.
  location    task_location not null default 'gym',

  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),

  constraint commitment_ends_after_start check (end_time > start_time)
);

create index commitments_day_idx on commitments (user_id, weekday, start_time);

alter table commitments enable row level security;
