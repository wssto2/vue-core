import { defineFeature, type Feature } from "../app";
import type { Destination } from "../router";
import { characteristicsPages } from "./routes";

export interface CharacteristicsFeatureOptions {
  /** The destination of the backend's menu that opens the screen. Without it the application links to `characteristicsPages.index` itself. */
  destination?: Destination;
}

/**
 * The screen of go-core's characteristics module, one feature to install: `/characteristics` (route `characteristics.index`) with the tree of
 * lookup lists, the sheet that edits an item, activating, reordering and deleting after the usage is shown. It is behind `characteristics:view`
 * (route access), its write actions behind `characteristics:edit`; go-core grants neither to anybody, so the application gives
 * `characteristics.Grants()` to its webmaster role. The server must have the module installed (`characteristics.Install`).
 *
 * The screen has no project-specific code: the levels, languages and extra fields come from the server's description of the tables.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), characteristicsFeature({ destination: "characteristics" })] })
 *
 * Why a feature, not a page to mount: the screen needs its route, its access rule and its title together, as the access and service account
 * screens do; `CharacteristicsPage` is exported for an application that wants its own route.
 */
export function characteristicsFeature(options: CharacteristicsFeatureOptions = {}): Feature {
  return defineFeature({
    id: "characteristics",
    routes: characteristicsPages.records,
    navigation: options.destination ? [{ destination: options.destination, to: characteristicsPages.index }] : [],
  });
}
