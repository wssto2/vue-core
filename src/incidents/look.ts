import type { Tone } from "../state";

// The enum values of go-core's incident module, with the message that names each and the badge tone that draws it.
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  new: "core.incidents.statuses.new",
  triaged: "core.incidents.statuses.triaged",
  in_progress: "core.incidents.statuses.in_progress",
  resolved: "core.incidents.statuses.resolved",
  ignored: "core.incidents.statuses.ignored",
  duplicate: "core.incidents.statuses.duplicate",
};

export const SEVERITY_LABELS: Readonly<Record<string, string>> = {
  low: "core.incidents.severities.low",
  medium: "core.incidents.severities.medium",
  high: "core.incidents.severities.high",
  critical: "core.incidents.severities.critical",
};

export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  user_report: "core.incidents.sources.user_report",
  runtime_error: "core.incidents.sources.runtime_error",
  client_error: "core.incidents.sources.client_error",
  mixed: "core.incidents.sources.mixed",
};

export const STATUS_TONES: Readonly<Record<string, Tone>> = {
  new: "info",
  triaged: "warning",
  in_progress: "warning",
  resolved: "positive",
  ignored: "neutral",
  duplicate: "neutral",
};

export const SEVERITY_TONES: Readonly<Record<string, Tone>> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "critical",
};
