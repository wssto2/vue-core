import type { HttpClient } from "../client";
import type { DeleteResponse, DescriptionResponse, ItemResponse, UsageResponse } from "../modules/characteristics/entities";
import { characteristicsRoutes } from "../modules/characteristics/routes";
import type { CreateInput, UpdateInput } from "../modules/characteristics/schemas";
import { usePlatform } from "../platform";

type Options = { readonly signal?: AbortSignal };

/** go-core's characteristics routes as calls; `data` of each answer already read. */
export function createCharacteristicsApi(http: HttpClient) {
  return {
    tree: async (options?: Options): Promise<readonly ItemResponse[]> => (await http.request(characteristicsRoutes.tree, undefined, options)).data.items,
    description: async (options?: Options): Promise<DescriptionResponse> => (await http.request(characteristicsRoutes.description, undefined, options)).data,
    usage: async (level: number, id: number, options?: Options): Promise<UsageResponse> => (await http.request(characteristicsRoutes.usage, { level, id }, options)).data,
    create: async (input: CreateInput, idempotencyKey: string): Promise<ItemResponse> => (await http.request(characteristicsRoutes.create, input, { idempotencyKey })).data,
    update: async (input: UpdateInput, idempotencyKey: string): Promise<ItemResponse> => (await http.request(characteristicsRoutes.update, input, { idempotencyKey })).data,
    setActive: async (level: number, id: number, active: boolean): Promise<ItemResponse> => (await http.request(characteristicsRoutes.setActive, { level, id, active })).data,
    /** `position` counts from 1 among the siblings. */
    move: async (level: number, id: number, position: number): Promise<void> => void (await http.request(characteristicsRoutes.move, { level, id, position })),
    /** Refused with `characteristics.in_use` or `characteristics.has_children` unless `force`. */
    remove: async (level: number, id: number, force = false): Promise<DeleteResponse> => (await http.request(characteristicsRoutes.delete, { level, id, ...(force ? { force: true } : {}) })).data,
  };
}

export type CharacteristicsApi = ReturnType<typeof createCharacteristicsApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useCharacteristicsApi = (): CharacteristicsApi => createCharacteristicsApi(usePlatform().http);
