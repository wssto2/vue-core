These are go-core's generated route tables, copied as the generator wrote them at go-core commit 727a37b
(`contract/testdata/tickets`, `identity/http/testdata/ts`, `access/accesshttp/testdata/access`).

One change: the import line of every `routes.ts` reads `@wssto2/vue-core/client` instead of `@wssto2/vue-core`,
which is what go-core's generator will emit (P2). `routes.test-d.ts` (run by `npm run typecheck:fixtures`) checks that they typecheck against the library
and that misuse of `request` is a compile error. They live outside `src/` because they import the package by name; `zod` is a dev dependency for the schemas.
