import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

/**
 * A record's groups, edited where they read (decision D22). A page of `FormGroup`s that carry a `group` becomes two things
 * without changing its markup:
 *
 * - **the read page** provides `edit`: each group reads, and one that can change shows **Edit** in its header (`GroupEditAction`)
 *   unless every field in it is locked. Its fields `register` with the page, so a failed save can name the group a field
 *   lives in, even when an empty read row is not drawn.
 * - **a group sheet** (`RecordGroupScope`) provides `only`: that group renders and every other one does not.
 */
export interface RecordGroupsContext {
  /** Only this group renders (inside a group sheet); null renders them all. */
  readonly only: Readonly<Ref<string | null>>;
  /** The group's Edit on a read page: what it does, or null when the group cannot change. */
  readonly edit?: (group: string, title: string) => (() => void) | null;
  /** The Edit action's own label for a group whose action is not "Edit" ("Change vehicle…"). */
  readonly editLabel?: (group: string) => string | undefined;
  /** A field of `group` mounted; returns the release. */
  readonly register?: (group: string, field: string) => () => void;
}

export const recordGroupsKey: InjectionKey<RecordGroupsContext> = Symbol("vue-core.recordGroups");

export const useRecordGroups = (): RecordGroupsContext | null => inject(recordGroupsKey, null);

/** Which group each field of a record page belongs to, collected from the fields that mounted. */
export interface FieldGroups<Group extends string = string> {
  register(group: Group, field: string): () => void;
  /** The group a field is in, or undefined when no mounted field of that name sits in a group. */
  groupOf(field: string): Group | undefined;
  /** The fields of a group, in the order they mounted. */
  fieldsOf(group: Group): string[];
}

export function createFieldGroups<Group extends string = string>(): FieldGroups<Group> {
  const groups = new Map<string, Map<Group, number>>();
  return {
    register(group, field) {
      const inside = groups.get(field) ?? new Map<Group, number>();
      inside.set(group, (inside.get(group) ?? 0) + 1);
      groups.set(field, inside);
      return () => {
        const count = (inside.get(group) ?? 1) - 1;
        if (count <= 0) inside.delete(group);
        else inside.set(group, count);
      };
    },
    groupOf: (field) => groups.get(field)?.keys().next().value,
    fieldsOf: (group) => [...groups.entries()].filter(([, inside]) => inside.has(group)).map(([field]) => field),
  };
}

export interface RecordGroupsOptions<Group extends string> {
  /** What Edit does for a group (open its sheet), or null for a group that cannot change. */
  edit: (group: Group, title: string) => (() => void) | null;
  editLabel?: (group: Group) => string | undefined;
}

/**
 * Makes the calling page a record page of groups: its `FormGroup`s show Edit, and its fields are collected, so a group sheet
 * knows which group a server error belongs to. Returns the field registry for `useGroupSheet`'s `groupOf`.
 *
 *   const groups = provideRecordGroups({ edit: (group) => sheets[group].present });
 */
export function provideRecordGroups<Group extends string>(options: RecordGroupsOptions<Group>): FieldGroups<Group> {
  const fields = createFieldGroups<Group>();
  provide(recordGroupsKey, {
    only: ref(null),
    edit: (group, title) => options.edit(group as Group, title),
    editLabel: options.editLabel ? (group) => options.editLabel?.(group as Group) : undefined,
    register: (group, field) => fields.register(group as Group, field),
  });
  return fields;
}
