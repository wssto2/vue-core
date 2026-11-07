// go-core's characteristics module (lookup lists kept as a tree in the project's own tables): the types and the route table of its HTTP contract
// (src/modules/characteristics, committed from go-core by `npm run modules:sync`), and the screen built on them. The select that picks from it,
// `CharacteristicField`, is in `@wssto2/vue-core/form`.
export type * from "../modules/characteristics/entities";
export type * as Inputs from "../modules/characteristics/schemas";
export { characteristicsRoutes } from "../modules/characteristics/routes";
export { characteristicsFeature } from "./feature";
export type { CharacteristicsFeatureOptions } from "./feature";
export { characteristicsPages } from "./routes";
export type { CharacteristicsPages } from "./routes";
export { createCharacteristicsApi, useCharacteristicsApi } from "./api";
export type { CharacteristicsApi } from "./api";
export { default as CharacteristicsPage } from "./CharacteristicsPage.vue";
