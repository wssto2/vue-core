// What stands in for an app's API and assets: placeholder photographs drawn on the fly (no network), a fake lead endpoint, and the state of one appraisal.
import { ApiError } from "@wssto2/vue-core/client";
import type { FormValidator } from "@wssto2/vue-core/form";
import { reactive } from "vue";

/** A 1600 × 1000 placeholder picture as a data URL: a coloured scene with a car-like shape and its number. */
export function placeholderPhoto(number: number, size: { width: number; height: number } = { width: 1600, height: 1000 }): string {
  const hue = (number * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 1600 1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 50% 22%)"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#g)"/>
    <rect y="720" width="1600" height="280" fill="rgba(0,0,0,0.25)"/>
    <path d="M300 640 l130 -200 h520 l210 200 z" fill="rgba(255,255,255,0.85)"/>
    <rect x="240" y="620" width="1000" height="150" rx="40" fill="rgba(255,255,255,0.95)"/>
    <circle cx="460" cy="780" r="85" fill="#111"/><circle cx="1020" cy="780" r="85" fill="#111"/>
    <circle cx="460" cy="780" r="38" fill="#999"/><circle cx="1020" cy="780" r="38" fill="#999"/>
    <rect x="40" y="40" width="1520" height="920" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6" stroke-dasharray="40 24"/>
    <text x="800" y="330" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="150" font-weight="700" fill="rgba(255,255,255,0.9)">Photo ${number}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** The playground's schema: one check per field. Real apps bring their own (Zod, Valibot); the library only asks for the `safeParse` shape. */
export function schema<Values extends object>(check: (values: Values) => Partial<Record<keyof Values & string, string>>): FormValidator<Values> {
  return {
    safeParse(input) {
      const issues = Object.entries(check(input as Values)).flatMap(([path, message]) => (message ? [{ path: [path], message: message as string }] : []));
      return issues.length ? { success: false, error: { issues } } : { success: true, data: input as Values };
    },
  };
}

export interface LeadBody {
  name: string;
  email: string;
  phone: string;
  make: string | null;
  model: string;
  budget: number | null;
  budgetUnknown: boolean;
}

/** Saves a lead; the address taken@example.com is refused the way a server would (422 on that field). */
export async function createLead(body: LeadBody): Promise<{ id: number }> {
  await sleep(700);
  if (body.email === "taken@example.com") throw new ApiError({ kind: "validation", message: "Refused", status: 422, fields: { email: ["This e-mail already has an open lead."] } });
  return { id: 1 };
}

/** The VINs the fake catalogue knows: ending in an odd digit it finds three versions, otherwise one. */
export async function findVersions(vin: string): Promise<readonly { id: string; label: string }[]> {
  await sleep(800);
  const odd = Number(vin.slice(-1)) % 2 === 1;
  const all = [
    { id: "life", label: "Golf 1.5 TSI Life, 110 kW" },
    { id: "style", label: "Golf 1.5 TSI Style, 110 kW" },
    { id: "rline", label: "Golf 1.5 TSI R-Line, 110 kW" },
  ];
  return odd ? all : all.slice(0, 1);
}

/** The one appraisal of the demo record: what each step knows about itself. Changing it moves the tiles' lines. */
export const appraisal = reactive({
  valuation: 12400 as number | null,
  marketComparison: false,
  photos: 4,
  offer: null as number | null,
});
