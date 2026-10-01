import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    workflows: true;
  }
}

export const workflowRoutes = defineRoutes({
  index: { name: "workflows.index", path: "/workflows", component: () => import("./views/Index.vue"), meta: { titleKey: "workflows.title" } },
  photos: { name: "workflows.photos", path: "/workflows/photos", component: () => import("./views/Photos.vue"), meta: { titleKey: "workflows.photos.title" } },

  // A workflow record: the sections are steps (tiles with a state each), in any order.
  appraisal: {
    name: "workflows.appraisal",
    path: "/workflows/appraisals/:appraisalID",
    component: () => import("./views/AppraisalRecord.vue"),
    meta: { titleKey: "workflows.appraisal.title", remountOnParam: "appraisalID" },
    children: [
      { name: "workflows.appraisal.valuation", path: "valuation", component: () => import("./views/AppraisalValuation.vue"), meta: { section: { labelKey: "workflows.appraisal.valuation", shortLabelKey: "workflows.appraisal.valuationShort", icon: "informationLine" } } },
      { name: "workflows.appraisal.report", path: "report", component: () => import("./views/AppraisalReport.vue"), meta: { section: { labelKey: "workflows.appraisal.report", shortLabelKey: "workflows.appraisal.reportShort", icon: "fileTextLine" } } },
      { name: "workflows.appraisal.offer", path: "offer", component: () => import("./views/AppraisalOffer.vue"), meta: { section: { labelKey: "workflows.appraisal.offer", shortLabelKey: "workflows.appraisal.offerShort", icon: "box2Line" } } },
    ],
  },
});
