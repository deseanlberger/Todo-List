-- A name for a time-block window.
--
-- Four windows all reading "Closed" tell you nothing about why. A Closed
-- window is closed for a reason — coaching, family, sleep — and the reason
-- is what makes the week readable, both in Settings and on the calendar.
--
-- Optional everywhere. An unnamed window behaves exactly as it did.

alter table availability_windows add column label text;
