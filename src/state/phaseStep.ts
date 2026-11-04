export type PhaseStep = {
  label: string;
  /** Optional text under the label (a date, who, how long). */
  subtitle?: string;
  /** A terminal step whose outcome is still open ("Zatvoren"): dashed while pending. */
  dashed?: boolean;
};
