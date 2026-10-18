const ticketsApiRoutes = [
  {
    name: "helpdesk.tickets.index",
    path: "/helpdesk/tickets",
    component: () => import("./views/Index.vue"),
    meta: {
      titleKey: "helpdesk.tickets.title",
      messages: ["helpdesk.tickets"],
    },
  },
] as const;

export default ticketsApiRoutes;
