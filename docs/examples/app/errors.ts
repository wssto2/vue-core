// Texts for the reasons your backend sends: go-core answers `{ code: "accounts.plan_in_use", params: { count: 3 } }`,
// and `describeError` looks for `errors.accounts.plan_in_use` in your messages (then in the library's `core.errors`).
export const errorMessages = {
  en: { errors: { accounts: { plan_in_use: "The plan is still used by {count} accounts. Move them first." } } },
  hr: { errors: { accounts: { plan_in_use: "Plan još koristi {count} računa. Prvo ih premjestite." } } },
};
