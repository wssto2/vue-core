import { defineRoutes } from "@wssto2/vue-core/router";

// Sections are the children with `meta.section`; the record page's navigator reads them. Access sits on the
// route once: the settings section needs a permission the demo user holds, the audit section one it does not.
export const recordRoutes = defineRoutes({
  index: { name: "records.index", path: "/records", component: () => import("./views/Index.vue"), meta: { access: "records:view", titleKey: "records.title" } },

  // A dealer: a source list of sections beside the content, drill-in rows on phones. The bare URL has no section
  // of its own: the navigator moves it to the first one the user may open.
  dealer: {
    name: "records.dealer",
    path: "/records/dealers/:dealerID",
    component: () => import("./views/DealerRecord.vue"),
    meta: { access: "records:view", titleKey: "records.dealers", remountOnParam: "dealerID" },
    children: [
      { name: "records.dealer.general", path: "general", component: () => import("./views/DealerGeneral.vue"), meta: { section: { labelKey: "records.sections.general", icon: "informationLine", groupKey: "records.groups.dealer" } } },
      { name: "records.dealer.locations", path: "locations", component: () => import("./views/DealerLocations.vue"), meta: { section: { labelKey: "records.sections.locations", icon: "box2Line", groupKey: "records.groups.dealer" } } },
      { name: "records.dealer.settings", path: "settings", component: () => import("./views/DealerSettings.vue"), meta: { access: "records:settings", section: { labelKey: "records.sections.settings", icon: "fileTextLine", groupKey: "records.groups.settings" } } },
      { name: "records.dealer.audit", path: "audit", component: () => import("./views/DealerAudit.vue"), meta: { access: "records:audit", section: { labelKey: "records.sections.audit", icon: "search", groupKey: "records.groups.settings" } } },
      // A page inside the Locations section: the section stays active and the page gets a back to it.
      { name: "records.dealer.location", path: "locations/:locationID", component: () => import("./views/DealerLocation.vue"), meta: { sectionParent: "records.dealer.locations" } },
    ],
  },

  // A customer: one section, so no navigation; the record opened from a list pages through it.
  customer: {
    name: "records.customer",
    path: "/records/customers/:customerID",
    component: () => import("./views/CustomerRecord.vue"),
    redirect: { name: "records.customer.general" },
    meta: { access: "records:view", titleKey: "records.customers", remountOnParam: "customerID" },
    children: [{ name: "records.customer.general", path: "general", component: () => import("./views/CustomerGeneral.vue"), meta: { section: { labelKey: "records.sections.general", icon: "informationLine" } } }],
  },

  // A lead: a custom layout composed from the same parts.
  lead: {
    name: "records.lead",
    path: "/records/leads/:leadID",
    component: () => import("./views/LeadRecord.vue"),
    meta: { access: "records:view", titleKey: "records.leads", remountOnParam: "leadID" },
    children: [
      { name: "records.lead.general", path: "general", component: () => import("./views/LeadGeneral.vue"), meta: { section: { labelKey: "records.sections.general", icon: "informationLine" } } },
      { name: "records.lead.timeline", path: "timeline", component: () => import("./views/LeadTimeline.vue"), meta: { section: { labelKey: "records.sections.timeline", icon: "refreshLine" } } },
    ],
  },
});
