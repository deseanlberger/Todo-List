-- Tasks that arrived from outside and have not been sorted yet.
--
-- Apple Reminders has no cloud API and no web app can read EventKit, so the
-- phone pushes rather than the server pulling: an iOS Shortcut posts new
-- reminders to /api/inbox. They arrive with no category on purpose — the
-- user sorts them, nothing is guessed.
--
-- `category` stays NOT NULL because the scheduler and every view read it.
-- `needs_category` is the honest signal: while it is true the stored
-- category is a placeholder, the task is held out of scheduling, and the
-- app asks for a real one.

alter table tasks add column needs_category boolean not null default false;

-- Where it came from, so the same reminder is never imported twice.
alter table tasks add column external_id text;

create unique index tasks_external_id_idx
  on tasks (user_id, external_id)
  where external_id is not null;

create index tasks_needs_category_idx
  on tasks (user_id)
  where needs_category and status <> 'done';
