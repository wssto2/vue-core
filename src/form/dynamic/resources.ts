/** An id the app's media library gives a resource (a picture, a document). */
export type ResourceId = number | string;

/** A row of the app's resource list; the picker needs nothing more. */
export interface ResourceItem {
  readonly id: ResourceId;
  readonly name?: string;
}

/** What the picker asks the app's list for. `accept` is the field's `props.accept` (`"image/*"`). */
export interface ResourceQuery {
  readonly search: string;
  /** From 1. */
  readonly page: number;
  readonly pageSize: number;
  readonly accept?: string;
}

/** The part of a list page the picker reads; a `ListPage<ResourceItem>` fits. */
export interface ResourcePage {
  readonly rows: readonly ResourceItem[];
  readonly lastPage: number;
}

/**
 * Where resources come from: the app's, since only it knows its media library (folders, search, type filter go into
 * `list`). A field holds ids; `thumbnail` turns one into a picture.
 */
export interface ResourceSource {
  list(query: ResourceQuery, context: { signal: AbortSignal }): Promise<ResourcePage>;
  /** A URL with `{id}` in it: `"/media/{id}/thumb"`. */
  thumbnail: string;
  /** The URL of the full picture, for an image placed in rich text. Default: `thumbnail`. */
  image?: string;
}

export const thumbnailUrl = (source: Pick<ResourceSource, "thumbnail">, id: ResourceId): string => source.thumbnail.replace("{id}", encodeURIComponent(String(id)));
