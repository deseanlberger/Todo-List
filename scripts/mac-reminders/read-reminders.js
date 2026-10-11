// Reads open reminders out of Reminders.app and prints the JSON body that
// POST /api/inbox expects.
//
// Run with:  osascript -l JavaScript read-reminders.js
//
// Why JXA and not AppleScript: this needs to emit JSON, and JSON.stringify
// handles the quoting, newlines and unicode in a reminder's text correctly.
// Doing that by hand in AppleScript string concatenation is how you end up
// posting a broken body the first time someone's reminder contains a quote.
//
// Why not run on a server: Apple Reminders has no cloud API, and iCloud
// exposes no endpoint for it. Reminders live behind EventKit, which is
// reachable only from code running on a signed-in Apple device. The Mac has
// to push; nothing can pull.

function run(argv) {
  const includeCompleted = argv.indexOf("--include-completed") !== -1;

  const Reminders = Application("Reminders");
  const items = [];
  const problems = [];

  let lists;
  try {
    lists = Reminders.lists();
  } catch (error) {
    // Almost always the automation permission prompt not yet accepted.
    return JSON.stringify({
      items: [],
      error: "Could not read Reminders: " + String(error),
    });
  }

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];

    let reminders;
    try {
      reminders = includeCompleted
        ? list.reminders()
        : list.reminders.whose({ completed: false })();
    } catch (error) {
      problems.push("list " + i + ": " + String(error));
      continue;
    }

    for (let j = 0; j < reminders.length; j++) {
      // One bad reminder must not lose the other twenty-nine.
      try {
        const reminder = reminders[j];

        const title = String(reminder.name() || "").trim();
        if (title === "") continue;

        // Reminders ids look like x-apple-reminderkit://... and are stable
        // for the life of the reminder, which is what makes a daily re-post
        // idempotent on the server.
        let id = "";
        try {
          id = String(reminder.id() || "");
        } catch (error) {
          id = "";
        }

        let due = null;
        try {
          const raw = reminder.dueDate();
          if (raw) due = raw.toISOString();
        } catch (error) {
          due = null;
        }

        let notes = null;
        try {
          const body = reminder.body();
          if (body && String(body).trim() !== "") notes = String(body).trim();
        } catch (error) {
          notes = null;
        }

        const entry = { title: title, due: due, notes: notes };
        // Omit a blank id rather than sending one: the server then keys off
        // the title, which is a better dedupe than an empty string shared by
        // every reminder that failed this read.
        if (id !== "") entry.id = id;

        items.push(entry);
      } catch (error) {
        problems.push("reminder " + i + "/" + j + ": " + String(error));
      }
    }
  }

  const payload = { items: items };
  if (problems.length > 0) payload.problems = problems;
  return JSON.stringify(payload);
}
