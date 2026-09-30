<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns, type RowAction } from "@wssto2/vue-core/collection";
import { IconTile } from "@wssto2/vue-core/controls";
import { toast } from "@wssto2/vue-core/overlay";
import type { PageAction } from "@wssto2/vue-core/page";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Customer } from "../api";
import { useCustomers } from "../context";
import { customerRoutes } from "../routes";

const { t } = useI18n();
const router = useRouter();
const { access } = usePlatform();
const { list } = useCustomers();

const name = (customer: Customer) => (customer.type === 2 ? customer.company_name : `${customer.first_name} ${customer.last_name}`);
const contact = (customer: Customer) => customer.email || customer.phone;
const recordOf = (customer: Customer) => customerRoutes.record({ customerID: customer.id });

// The phone row is the name and contact, with city and entry date as meta; the last change stays on desktop.
const columns = computed(() => [
  { key: "id", label: t("customers.name"), kind: "identity", title: name, subtitle: contact, mobile: "primary" },
  { key: "city", label: t("customers.city"), width: 200, hideBelow: "md", mobile: "meta" },
  { key: "created_at", label: t("customers.created"), kind: "timestamp", sort: "created_at", width: 150, hideBelow: "md", mobile: "meta" },
  { key: "updated_at", label: t("customers.updated"), kind: "timestamp", sort: "updated_at", width: 150, hideBelow: "md", mobile: "hidden" },
] satisfies CollectionColumns<Customer>);

const customers = useCollection(list, { columns, state: { kind: "url", key: "query" }, recordRoute: recordOf });

const actions = computed<PageAction[]>(() =>
  access.can("customers:create")
    ? [{ id: "create", label: t("customers.create"), icon: "phoneLine", placement: "primary", compact: "icon", keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => toast.info(t("customers.creating")) }]
    : [],
);

// Row shortcuts: call and e-mail for the channels the customer has, then the record.
function rowActions(customer: Customer): RowAction[] {
  const actions: RowAction[] = [];
  const phone = customer.phone?.replace(/\s+/g, "");
  if (phone) actions.push({ key: "call", label: t("customers.call"), icon: "phoneLine", href: `tel:${phone}`, tone: "positive", section: "contact" });
  if (customer.email) actions.push({ key: "email", label: t("customers.email"), icon: "mailLine", href: `mailto:${customer.email}`, tone: "info", section: "contact" });
  actions.push({ key: "view", label: t("customers.details"), icon: "fileTextLine", section: "record", onSelect: () => void router.push(recordOf(customer)) });
  return actions;
}
</script>

<template>
  <CollectionPage :collection="customers" :title="t('customers.title')" :description="t('customers.description')" :actions="actions"
    :row-actions="rowActions" :row-label="name" :row-height="61">
    <template #leading="{ item }"><IconTile tone="neutral" size="md" :text="name(item).slice(0, 1)" /></template>
  </CollectionPage>
</template>
