import { defineFeatureContext } from "../platform";

/** What an application tells the characteristics screen. */
export interface CharacteristicsContext {
  /**
   * The add phrase of a level, whole ("Dodaj marku"): `parent` is the item the new one goes under (`null`: a root), `level` the new item's level
   * (from 1). Return `undefined` for the library's neutral phrase ("Dodaj skupinu" at the top, "Dodaj stavku" below).
   */
  readonly addLabel: ((parent: { level: number; name: string } | null, level: number) => string | null | undefined) | null;
}

export const [characteristicsContextKey, useCharacteristicsContext] = defineFeatureContext<CharacteristicsContext>("vue-core.characteristics");
