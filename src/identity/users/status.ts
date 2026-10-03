import type { Status } from "../../modules/identity/entities";
import type { Tone } from "../../state";

/** The tone of a person's status: active is fine, locked needs attention, inactive is quiet. */
export const statusTone = (status: Status): Tone => (status === "locked" ? "critical" : status === "inactive" ? "neutral" : "positive");
