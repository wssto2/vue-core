export type TodoRowState = "done" | "missing" | "waiting" | "optional";

/** `ariaLabel` names the document for screen readers when the visible label is just the verb. */
export type TodoRowAction = { label: string; onClick: () => void; testId?: string; ariaLabel?: string };
