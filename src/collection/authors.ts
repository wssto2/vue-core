/** A person behind a record, as go-core's `meta.author` / `meta.editor` and a list's `meta.authors` carry them. */
export interface ResourceAuthor {
  readonly id: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone_number: string | null;
  readonly avatar: string | null;
  readonly active: boolean;
}

/** The `meta` of a record answer: who created it and who last changed it (and who switched it on or off, where the resource has that). */
export interface ResourceMeta {
  readonly author: ResourceAuthor | null;
  readonly editor: ResourceAuthor | null;
  readonly activator?: ResourceAuthor | null;
  readonly deactivator?: ResourceAuthor | null;
  readonly [key: string]: unknown;
}

/**
 * The person behind a row's `created_by` / `updated_by`: a list answer carries them once, in `meta.authors`.
 *
 *   const creator = authorOf(page.meta, row.created_by);
 *
 * Null for no id, no `authors` in the meta, or an id nobody in it has. `A` is your own author type where it has more fields.
 */
// NoInfer: a call inside another call's argument would otherwise infer A from that parameter and lose the default.
export function authorOf<A extends { readonly id: number } = ResourceAuthor>(meta: object | null | undefined, id: number | null | undefined): NoInfer<A> | null {
  const authors = (meta as { authors?: unknown } | null | undefined)?.authors;
  return id == null || !Array.isArray(authors) ? null : ((authors as A[]).find((author) => author.id === id) ?? null);
}
