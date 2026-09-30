import { ApiError, kindForStatus, type FieldErrors } from "./error";

export const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * What a successful call returns. go-core's envelope `{ success, data, meta, message }` is unwrapped;
 * a body without `success` (for example `/auth/me`) is the data itself; an empty body is `data: null`.
 */
export interface ApiResult<TData, TMeta = unknown> {
  data: TData;
  meta: TMeta | null;
  message: string | null;
  status: number;
  requestId: string | null;
}

type Payload = Record<string, unknown>;

const isObject = (value: unknown): value is Payload =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** `errors` (validation: string or string[] per field) or `fields` (conflicts: string per field). */
function readFields(payload: Payload | null): FieldErrors {
  const source = payload?.errors ?? payload?.fields;
  if (!isObject(source)) return {};
  const fields: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(source)) {
    if (Array.isArray(messages)) fields[field] = messages.map(String);
    else if (messages !== null && messages !== undefined) fields[field] = [String(messages)];
  }
  return fields;
}

async function readBody(response: Response): Promise<{ payload: unknown; readable: boolean }> {
  const body = await response.text();
  if (body.trim() === "") return { payload: null, readable: true };
  try {
    return { payload: JSON.parse(body) as unknown, readable: true };
  } catch {
    return { payload: null, readable: false };
  }
}

/** Turns a response into an `ApiResult`, or throws the `ApiError` its status and body describe. `sentId` is the id this client sent. */
export async function readResponse<TData, TMeta>(
  response: Response,
  sentId: string | null,
): Promise<ApiResult<TData, TMeta>> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentId;
  const { payload, readable } = await readBody(response);
  const body = isObject(payload) ? payload : null;

  if (!response.ok) {
    const fields = readFields(body);
    const params = body?.params;
    throw new ApiError({
      kind: kindForStatus(response.status, Object.keys(fields).length > 0),
      message: text(body?.error) ?? text(body?.message) ?? `Request failed with status ${response.status}`,
      status: response.status,
      fields,
      code: text(body?.code),
      params: isObject(params) ? params : null,
      requestId,
      payload,
    });
  }

  if (!readable) {
    throw new ApiError({
      kind: "malformed",
      message: `The server answered ${response.status} with a body that is not JSON`,
      status: response.status,
      requestId,
    });
  }

  // go-core always sends `success`; a body without it is the payload itself.
  if (body !== null && typeof body.success === "boolean") {
    return {
      data: (body.data ?? null) as TData,
      meta: (body.meta ?? null) as TMeta | null,
      message: text(body.message),
      status: response.status,
      requestId,
    };
  }
  return { data: payload as TData, meta: null, message: null, status: response.status, requestId };
}
