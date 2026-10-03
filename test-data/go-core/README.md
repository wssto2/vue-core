`tickets/` is go-core's generated route table for a sample feature, copied as the generator wrote it at go-core commit 727a37b
(`contract/testdata/tickets`), with one change: the import line of `routes.ts` reads `@wssto2/vue-core/client` instead of `@wssto2/vue-core`.
`identity` and `access` are the real module types, committed under `src/modules/` (`npm run modules:sync`).
`routes.test-d.ts` (run by `npm run typecheck:fixtures`) checks that they typecheck against the library
and that misuse of `request` is a compile error. They live outside `src/` because they import the package by name; `zod` is a dev dependency for the schemas.
