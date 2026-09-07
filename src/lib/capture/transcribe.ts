import "server-only";
import { env, hasEnv } from "@/lib/env";

/**
 * §17.2. Voice notes are transcribed before Claude parses them.
 *
 * Transcription is a seam rather than a hard dependency: wire whatever
 * service you have a key for. Without one the bot says so plainly instead of
 * silently dropping a voice note, which would be the worst outcome — the
 * user has already spoken and moved on.
 */
export function transcriptionIsConfigured(): boolean {
  return hasEnv("TRANSCRIPTION_API_KEY") && hasEnv("TRANSCRIPTION_URL");
}

export async function transcribe(
  audio: ArrayBuffer,
  filename = "voice.ogg",
): Promise<string> {
  if (!transcriptionIsConfigured()) {
    throw new Error("No transcription service configured");
  }

  const form = new FormData();
  form.append("file", new Blob([audio]), filename);
  form.append("model", env("TRANSCRIPTION_MODEL", "whisper-1"));

  const response = await fetch(process.env.TRANSCRIPTION_URL!, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.TRANSCRIPTION_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { text?: string };
  if (!json.text) throw new Error("Transcription returned no text");
  return json.text;
}
