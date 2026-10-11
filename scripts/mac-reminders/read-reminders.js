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
//
// SPEED. Every property access across the JXA bridge is a separate Apple
// Event, and they cost milliseconds each. Reading four properties off each
// of four hundred reminders one at a time is sixteen hundred round trips,
// which takes minutes and looks exactly like a hang. Asking a COLLECTION
// for a property instead — `list.reminders.name()` — returns the whole
// column in a single event, so a list costs five events regardless of how
// many reminders are in it. That is the difference between this finishing
// in about a second and not appearing to finish at all.

function run() {
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

    // The list name is the single most valuable field here. Desean keeps
    // lists called Deep Focus, Deep Admin, Multitasking Admin, Personal and
    // Delegate — he has already categorised this work by hand, and his own
    // filing beats anything a model can infer from a one-line title.
    let listName = "";
    try {
      listName = String(list.name() || "");
    } catch (error) {
      listName = "";
    }

    // Five bulk reads per list, not five per reminder.
    let names, ids, dues, bodies, done;
    try {
      const rows = list.reminders;
      names = rows.name();
      done = rows.completed();
      ids = rows.id();
      dues = rows.dueDate();
      bodies = rows.body();
    } catch (error) {
      problems.push("list " + i + ": " + String(error));
      continue;
    }

    for (let j = 0; j < names.length; j++) {
      // Completed work is finished; it is not a task to schedule.
      if (done && done[j] === true) continue;

      const title = String(names[j] == null ? "" : names[j]).trim();
      if (title === "") continue;

      // Reminders ids look like x-apple-reminderkit://... and are stable
      // for the life of the reminder, which is what makes a daily re-post
      // idempotent on the server. Omit a blank one rather than sending it:
      // the server then keys off the title, which is a better dedupe than
      // an empty string shared by every reminder that failed this read.
      const id = ids && ids[j] != null ? String(ids[j]) : "";

      let due = null;
      const rawDue = dues ? dues[j] : null;
      if (rawDue) {
        try {
          due = new Date(rawDue).toISOString();
        } catch (error) {
          due = null;
        }
      }

      let notes = null;
      const rawBody = bodies ? bodies[j] : null;
      if (rawBody != null && String(rawBody).trim() !== "") {
        notes = String(rawBody).trim();
      }

      const entry = { title: title, due: due, notes: notes };
      if (id !== "") entry.id = id;
      if (listName !== "") entry.list = listName;
      items.push(entry);
    }
  }

  const payload = { items: items };
  if (problems.length > 0) payload.problems = problems;
  return JSON.stringify(payload);
}
