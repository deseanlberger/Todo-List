import "server-only";
import { CATEGORIES } from "@/lib/domain/categories";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { WEEKDAY_LABELS, zonedParts } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";

const API = "https://api.telegram.org";

export function telegramIsConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return value;
}

/**
 * The webhook secret Telegram echoes back in a header. Without it anyone who
 * finds the URL can post tasks into the backlog.
 */
export function webhookSecretMatches(header: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // No secret configured; nothing to check.
  return header === expected;
}

async function call<T>(method: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description}`);
  return json.result as T;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: InlineButton[][],
): Promise<{ message_id: number }> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function answerCallbackQuery(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

/** Download a Telegram voice note, for transcription. */
export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const file = await call<{ file_path: string }>("getFile", { file_id: fileId });
  const response = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
  if (!response.ok) throw new Error(`Could not download ${file.file_path}`);
  return response.arrayBuffer();
}

/* ------------------------------------------------------------- formatting */

/**
 * The bot's reply, following screen 1l: a count, then one parsed block per
 * task with a mono-style spec line, then what happens next.
 */
export function formatCaptureReply(tasks: Task[]): string {
  const lines: string[] = [
    `${tasks.length} ${tasks.length === 1 ? "TASK" : "TASKS"} CAPTURED`,
    "",
  ];

  for (const task of tasks) {
    lines.push(task.title);
    lines.push(specLine(task));
    lines.push("");
  }

  const delegated = tasks.filter((task) => task.category === "delegate");
  if (delegated.length === tasks.length && tasks.length > 0) {
    lines.push(
      tasks.length === 1
        ? "It sits in the delegate list for the next handoff block."
        : "They sit in the delegate list for the next handoff block.",
    );
  } else {
    lines.push(
      tasks.length === 1
        ? "It sits in the backlog. Press Schedule My Week in the app to place it."
        : "They sit in the backlog. Press Schedule My Week in the app to place them.",
    );
  }

  return lines.join("\n");
}

/** `HI-PRI ADMIN · HOME · 1 BLOCK · DUE WED · IMPACT 5` */
export function specLine(task: Task): string {
  const meta = CATEGORIES[task.category];
  const parts = [meta.shortLabel, task.location.toUpperCase()];

  if (meta.schedules) {
    parts.push(`${task.estimatedBlocks} BLOCK${task.estimatedBlocks === 1 ? "" : "S"}`);
  } else if (task.assignee) {
    parts.push(`→ ${task.assignee.toUpperCase()}`);
  }

  if (task.dueDate) {
    const day = zonedParts(new Date(task.dueDate), CALENDAR_TIME_ZONE).weekday;
    parts.push(`DUE ${WEEKDAY_LABELS[day]}`);
  }

  parts.push(`IMPACT ${task.financialImpact}`);
  return parts.join(" · ");
}

/**
 * Quick-edit buttons per task. Callback data is `field:taskId`, kept short
 * because Telegram caps it at 64 bytes.
 */
export function quickEditButtons(task: Task): InlineButton[][] {
  const row: InlineButton[] = [
    { text: "Category", callback_data: `cat:${task.id}` },
    { text: "Location", callback_data: `loc:${task.id}` },
  ];

  if (CATEGORIES[task.category].schedules) {
    row.push({ text: "Blocks", callback_data: `blk:${task.id}` });
    row.push({ text: "Delegate →", callback_data: `del:${task.id}` });
  }

  return [row];
}

/** §14. The recurring lead-time reminder, one day before by default. */
export function formatReminder(task: Task, whenLabel: string, placedAt: string | null): string {
  const placed = placedAt
    ? ` Recurring, already placed at ${placedAt}.`
    : " Recurring, not placed yet — press Schedule My Week.";
  return `LEAD-TIME REMINDER\n\n${task.title} is due ${whenLabel}.${placed}`;
}
