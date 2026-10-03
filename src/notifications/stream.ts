import type { Transport } from "../client";
import type { StreamEvent } from "../modules/notification/entities";

/** Why a stream ended: the caller reconnects, except after `aborted`. */
export type StreamEnd = "closed" | "unauthorized" | "failed" | "aborted" | "stalled";

export interface ReadStreamOptions {
  url: string;
  transport: Transport;
  signal: AbortSignal;
  onEvent(event: StreamEvent): void;
  /** A connection that sends nothing, not even a heartbeat, for this long is dropped. go-core beats every 25 s. */
  idleTimeout: number;
}

const KINDS: readonly string[] = ["created", "read", "unread"];

/** One server-sent message block as an event; a comment (`: ping`), a block without data and an unreadable one give null. */
export function parseStreamMessage(message: string): StreamEvent | null {
  const data = message
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (data === "") return null;
  try {
    const event: unknown = JSON.parse(data);
    if (typeof event !== "object" || event === null) return null;
    const { type, unread_count } = event as { type?: unknown; unread_count?: unknown };
    return typeof type === "string" && KINDS.includes(type) && typeof unread_count === "number" ? (event as StreamEvent) : null;
  } catch {
    return null;
  }
}

/**
 * Opens the notification stream and reads it until it ends. `EventSource` cannot send headers and
 * cannot tell a dead connection from a quiet one, so the byte stream is read with `fetch` through the
 * platform's transport: the session cookie goes with it, the heartbeat resets a watchdog, and aborting
 * the signal ends it at once.
 */
export async function readStream({ url, transport, signal, onEvent, idleTimeout }: ReadStreamOptions): Promise<StreamEnd> {
  if (signal.aborted) return "aborted";

  const connection = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let stalled = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    connection.abort();
    // a pending read settles even where aborting the request does not reach the body
    void reader?.cancel().catch(() => undefined);
  };
  const arm = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      stop();
    }, idleTimeout);
  };
  signal.addEventListener("abort", stop, { once: true });
  arm();

  try {
    const response = await transport(url, { method: "GET", headers: { Accept: "text/event-stream" }, credentials: "include", signal: connection.signal });
    if (response.status === 401) return "unauthorized";
    if (!response.ok || !response.body) return "failed";

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return "aborted";
      if (stalled) return "stalled";
      if (done) return "closed";
      arm();
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const event = parseStreamMessage(message);
        if (event) onEvent(event);
      }
    }
  } catch (error) {
    if (signal.aborted) return "aborted";
    return stalled ? "stalled" : error instanceof Error && error.name === "AbortError" ? "aborted" : "failed";
  } finally {
    clearTimeout(watchdog);
    signal.removeEventListener("abort", stop);
  }
}
