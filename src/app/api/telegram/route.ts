import { NextResponse } from "next/server";
import { parseCapture } from "@/lib/capture/parse";
import { transcribe, transcriptionIsConfigured } from "@/lib/capture/transcribe";
import { repository } from "@/lib/data";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/domain/categories";
import type { Task, TaskCategory } from "@/lib/domain/types";
import {
  answerCallbackQuery,
  downloadFile,
  editMessage,
  formatCaptureReply,
  quickEditButtons,
  sendMessage,
  specLine,
  telegramIsConfigured,
  webhookSecretMatches,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * SCHEDULER_RULES §17. Capture only — completing and closing out blocks
 * happens in the app, never over Telegram.
 */
export async function POST(request: Request) {
  if (!telegramIsConfigured()) {
    return NextResponse.json({ error: "Telegram is not configured" }, { status: 503 });
  }

  if (!webhookSecretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Bad secret" }, { status: 401 });
  }

  const update = await request.json();

  try {
    if (update.callback_query) {
      await handleQuickEdit(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (cause) {
    console.error("Telegram update failed:", cause);
    // Always 200: a non-200 makes Telegram retry the same update forever.
  }

  return NextResponse.json({ ok: true });
}

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; duration: number };
  audio?: { file_id: string };
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id;

  let text = message.text?.trim() ?? "";
  let source: Task["captureSource"] = "telegram_text";

  const voiceFileId = message.voice?.file_id ?? message.audio?.file_id;
  if (voiceFileId) {
    if (!transcriptionIsConfigured()) {
      await sendMessage(
        chatId,
        "I can't transcribe voice notes yet — no transcription service is configured. Send it as text and I'll capture it.",
      );
      return;
    }
    text = await transcribe(await downloadFile(voiceFileId));
    source = "telegram_voice";
  }

  if (!text) return;

  if (text.startsWith("/")) {
    await handleCommand(chatId, text);
    return;
  }

  const repo = repository();
  const history = await repo.listEstimationHistory(50);
  const parsed = await parseCapture({ text, history, now: new Date() });

  if (parsed.length === 0) {
    await sendMessage(chatId, "I couldn't find a task in that. Try again?");
    return;
  }

  const created: Task[] = [];
  for (const task of parsed) {
    created.push(
      await repo.createTask({
        title: task.title,
        notes: null,
        category: task.category,
        location: task.location,
        estimatedBlocks: task.estimatedBlocks,
        actualBlocks: null,
        dueDate: task.dueDate,
        financialImpact: task.financialImpact,
        assignee: task.assignee,
        handedOffAt: null,
        status: "backlog",
        isRecurring: false,
        recurrenceRule: null,
        reminderLeadDays: 1,
        captureSource: source,
        // Kept so he can check what Claude heard (screen 1k).
        captureTranscript: text,
        completedAt: null,
      }),
    );
  }

  await sendMessage(chatId, formatCaptureReply(created));

  // One quick-edit row per task, so the buttons are unambiguous.
  for (const task of created) {
    await sendMessage(chatId, `${task.title}\n${specLine(task)}`, quickEditButtons(task));
  }
}

async function handleCommand(chatId: number, text: string) {
  const command = text.split(/\s+/)[0].toLowerCase();

  if (command === "/start" || command === "/help") {
    await sendMessage(
      chatId,
      [
        "Send me a task and I'll put it in the backlog.",
        "",
        "Voice or text. Several in one message is fine — I'll split them.",
        "",
        "I capture. Scheduling and closing out blocks happen in the app.",
      ].join("\n"),
    );
    return;
  }

  if (command === "/backlog") {
    const tasks = (await repository().listTasks()).filter(
      (task) => task.status === "backlog",
    );
    if (tasks.length === 0) {
      await sendMessage(chatId, "Backlog is empty.");
      return;
    }
    await sendMessage(
      chatId,
      [`${tasks.length} OPEN`, "", ...tasks.map((task) => `${task.title}\n${specLine(task)}\n`)].join("\n"),
    );
    return;
  }

  await sendMessage(chatId, "I only know /help and /backlog.");
}

interface CallbackQuery {
  id: string;
  data: string;
  message: { chat: { id: number }; message_id: number };
}

/** The quick-edit buttons from screen 1l: cycle a field, redraw the line. */
async function handleQuickEdit(query: CallbackQuery) {
  const [field, taskId] = query.data.split(":");
  const repo = repository();
  const task = await repo.getTask(taskId);

  if (!task) {
    await answerCallbackQuery(query.id, "That task is gone.");
    return;
  }

  let updated = task;

  if (field === "cat") {
    // Cycles the schedulable categories only; "Delegate →" is its own button.
    const order: TaskCategory[] = CATEGORY_ORDER.filter((c) => c !== "delegate");
    const current = order.indexOf(task.category);
    const next = order[(current + 1) % order.length];
    updated = await repo.updateTask(task.id, {
      category: next,
      estimatedBlocks: CATEGORIES[next].schedules ? task.estimatedBlocks : 1,
      assignee: null,
    });
  }

  if (field === "loc") {
    updated = await repo.updateTask(task.id, {
      location: task.location === "home" ? "gym" : "home",
    });
  }

  if (field === "blk") {
    updated = await repo.updateTask(task.id, {
      estimatedBlocks: (task.estimatedBlocks % 4) + 1,
    });
  }

  if (field === "del") {
    updated = await repo.updateTask(task.id, {
      category: "delegate",
      estimatedBlocks: 1,
    });
  }

  await answerCallbackQuery(query.id);
  await editMessage(
    query.message.chat.id,
    query.message.message_id,
    `${updated.title}\n${specLine(updated)}`,
    quickEditButtons(updated),
  );
}
