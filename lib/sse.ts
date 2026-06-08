// Streams the chat SSE response and dispatches parsed events.
//
// The browser EventSource API can't send Authorization headers or POST bodies,
// so we read the fetch ReadableStream and parse `data:` frames ourselves.

import { API_URL, getToken } from "./api";

export type ChatEvent =
  | { type: "token"; content: string }
  | { type: "tool"; name: string; status: "start" | "end" }
  | { type: "done"; conversation_id: string }
  | { type: "error"; message: string };

/** Pure: split a buffer into complete SSE payloads, returning [events, remainder]. */
export function parseSSEBuffer(buffer: string): [ChatEvent[], string] {
  const events: ChatEvent[] = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const frame = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const dataLine = frame
      .split("\n")
      .find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const json = dataLine.slice(5).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as ChatEvent);
    } catch {
      // skip malformed frame
    }
  }
  return [events, rest];
}

export async function streamChat(
  body: { content: string; conversation_id?: string | null },
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const [events, rest] = parseSSEBuffer(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
}
