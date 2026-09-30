// Type fixtures of the collection API, checked by the playground's `vue-tsc` through the packed
// declarations: what the leads' query contract declares is enforced at the call site. Never imported at runtime.
import { useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import { createLeadsApi, type Lead } from "./api";
import { createLeadList } from "./collection";

export function fixtures() {
  const definition = createLeadList(createLeadsApi(null as never));
  const leads = useCollection(definition, { state: { kind: "memory" } });

  leads.sortBy("first_name");
  // @ts-expect-error the leads backend does not declare a sort by e-mail
  leads.sortBy("email");
  leads.setFilter("followup", "overdue");
  // @ts-expect-error nor a filter by e-mail
  leads.setFilter("email", "a@b.c");
  leads.setView("mine");
  // @ts-expect-error a view the contract does not list
  leads.setView("team");

  // @ts-expect-error a column key that is not a property of a lead
  void ([{ key: "nickname", label: "Nickname" }] satisfies CollectionColumns<Lead>);
  void ([{ key: "phase.assigned_to", label: "Assigned" }] satisfies CollectionColumns<Lead>);

  // @ts-expect-error a state source is a url key or memory
  useCollection(definition, { state: { kind: "session" } });
}
