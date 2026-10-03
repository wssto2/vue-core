import type { InjectionKey } from "vue";
import { defineFeatureContext } from "../../platform";
import type { RouteResource } from "../../resource";
import type { Load } from "../../state";
import type { SessionList, UserDetail } from "../../modules/identity/entities";

/** The person a record page is about, shared with its routed sections (`useRouteResourceContext(PERSON)`). */
export const PERSON: InjectionKey<RouteResource<UserDetail>> = Symbol("vue-core.users.person");

/** What the viewer may do with this person right now, and the dialogs that do it (they live on the record page). */
export interface PersonActions {
  readonly can: {
    /** Edit the details, set a password, unlock, end sessions: whoever holds `iam.user:manage`. */
    readonly manage: boolean;
    /** Never one's own account (go-core refuses it), never one that is already inactive. */
    readonly deactivate: boolean;
    readonly activate: boolean;
    /** Sessions of somebody else; one's own are ended in "my profile", where this device is kept. */
    readonly endSessions: boolean;
  };
  deactivate(): void;
  activate(): void;
  setPassword(): void;
  /** After something changed the person's state under the page (a new password unlocks, a deactivation ends sessions). */
  refresh(): Promise<void>;
}

export const [personActionsKey, usePersonActions] = defineFeatureContext<PersonActions>("vue-core.users.personActions");

/** The person's live sessions: loaded once by the record page (it counts them) and shared with the Sessions section. */
export const [personSessionsKey, usePersonSessions] = defineFeatureContext<Load<SessionList>>("vue-core.users.personSessions");
