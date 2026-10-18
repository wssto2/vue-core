import { currentApplication } from "../app/current";
import { ApiError } from "../client";
import type { ResourceContext } from "./resource";

/**
 * The `load` of a record page on `useRouteResource` / `useResource`: one GET through the current application's client, which answers
 * with `ApiError` (so a 404 reads as "not found" and a page that was left aborts its read). The client is read on each call, so a feature's
 * api declares its reads at module level, before the application exists.
 *
 *   const dealerRecord = (id: number, context: ResourceContext) => readRecord<DealerRecord>(`/v1/dealers/${id}`, context);
 */
export async function readRecord<T>(path: string, context: Pick<ResourceContext, "signal">): Promise<T> {
  return (await currentApplication().platform.http.get<T>(path, { signal: context.signal })).data;
}

/** `readRecord` for an answer that carries `meta` beside the record (the authors, the comments); `meta` is the caller's word, not checked. */
export async function readRecordWithMeta<T, M>(path: string, context: Pick<ResourceContext, "signal">): Promise<{ data: T; meta: M | null }> {
  const { data, meta } = await currentApplication().platform.http.get<T, M>(path, { signal: context.signal });
  return { data, meta };
}

/** The record a read found: the server answers `null` only where there is none, which a page reads as "not found" (404), never as a record. */
export function found<T>(record: T | null): T {
  if (record === null) throw new ApiError({ kind: "notFound", message: "Not found", status: 404 });
  return record;
}
