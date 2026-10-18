const __FEATURE_API_CLIENT__Routes = [
  {
    name: "__FEATURE_ROUTE_NAME__",
    path: "__FEATURE_ROUTE_PATH__",
    component: () => import("./views/Index.vue"),
    meta: {
      titleKey: "__FEATURE_I18N_MODULE__.title",
      messages: ["__FEATURE_I18N_MODULE__"],
    },
  },
] as const;

export default __FEATURE_API_CLIENT__Routes;
