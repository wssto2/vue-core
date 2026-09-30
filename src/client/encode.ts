export type QueryValue = string | number | boolean | null | undefined | readonly (string | number | boolean)[];

/** Query parameters: null, undefined and "" are left out, arrays repeat the key. */
export function buildQuery(query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) for (const item of value) params.append(key, String(item));
    else params.append(key, String(value));
  }
  return params.toString();
}

const isBlob = (value: unknown): value is Blob => typeof Blob !== "undefined" && value instanceof Blob;

/** The multipart form of an object: a file or blob somewhere in it selects this encoding. */
export function toFormData(values: Readonly<Record<string, unknown>>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) form.append(`${key}[]`, scalar(item));
    } else {
      form.append(key, scalar(value));
    }
  }
  return form;
}

function scalar(value: unknown): string | Blob {
  if (isBlob(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

export interface EncodedBody {
  body: BodyInit | undefined;
  /** Set only when the body is JSON; multipart and raw bodies carry their own type. */
  contentType: string | null;
}

/**
 * JSON for plain values, multipart when an object holds a file or blob, and raw bodies
 * (`FormData`, `Blob`, `URLSearchParams`, string, buffers) untouched.
 */
export function encodeBody(body: unknown): EncodedBody {
  if (body === undefined) return { body: undefined, contentType: null };
  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    isBlob(body)
  ) {
    return { body: body as BodyInit, contentType: null };
  }
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const values = body as Record<string, unknown>;
    if (Object.values(values).some((value) => isBlob(value) || (Array.isArray(value) && value.some(isBlob)))) {
      return { body: toFormData(values), contentType: null };
    }
  }
  return { body: JSON.stringify(body), contentType: "application/json" };
}

/** 32 hex characters: valid for go-core's `X-Request-ID` (`^[a-zA-Z0-9-_]{1,128}$`), and unlike `randomUUID` available outside secure contexts. */
export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
