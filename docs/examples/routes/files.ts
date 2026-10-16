import { createHttpClient, isApiError, saveBlob } from "@wssto2/vue-core/client";

const http = createHttpClient({ baseUrl: "/api" });

// A file: the bytes, the name the server proposes (null when it proposes none) and the request id.
export async function saveReport(id: number, signal: AbortSignal) {
  try {
    const { blob, filename } = await http.download(`/v1/reports/${id}/pdf`, { signal, accept: "application/pdf" });
    saveBlob(blob, filename ?? `report-${id}.pdf`);
  } catch (error) {
    // the same ApiError as a JSON call: kind, code, params, requestId from the server's error body
    if (isApiError(error)) return error.code;
    throw error;
  }
}

// A POST with a body, encoded like `post`.
export const exportRows = (ids: number[]) => http.download("/v1/rows/export", { method: "POST", body: { ids } });

// A stream: the raw Response once the headers are in; the signal ends it.
export async function follow(onEvent: (chunk: string) => void, signal: AbortSignal) {
  const response = await http.stream("/v1/events", { accept: "text/event-stream", signal });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (let part = await reader.read(); !part.done; part = await reader.read()) onEvent(part.value);
}
