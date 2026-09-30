/**
 * What a status means, independent of how it looks. The components map a tone to the status
 * roles of the theme (`status-<name>-content` on `status-<name>-surface`), so a brand accent never
 * replaces the meaning of warning or critical.
 */
export type Tone = "neutral" | "info" | "positive" | "warning" | "critical";
