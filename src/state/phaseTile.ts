import type { RouteLocationRaw } from "vue-router";

export type PhaseTile = {
  key: string;
  label: string;
  state: "done" | "current" | "later" | "skipped";
  /** One line under the label ("Preuzeto 13. 9. · Sto2 Test", "Nedostaju 3 stavke"). */
  sub?: string;
  tone?: "warning" | "danger" | "success";
  to?: RouteLocationRaw;
};
