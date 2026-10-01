import { missingLocales, type FormValidator } from "@wssto2/vue-core/form";
import type { OfferBody } from "./api";

/** What the offer's fields edit. Numbers are null until typed; a channel is chosen or not. */
export interface OfferValues {
  customerId: number | null;
  title: Record<string, string>;
  deliveryOn: string | null;
  channel: "email" | "phone" | null;
  lines: { product: string; quantity: number | null; unitPrice: number | null }[];
  urgent: boolean;
  extras: string[];
  note: string;
}

/** What the server receives once the schema accepted the draft: nothing is null any more, which the types say. */
export interface OfferInput {
  customerId: number;
  title: Record<string, string>;
  deliveryOn: string | null;
  channel: "email" | "phone";
  lines: { product: string; quantity: number; unitPrice: number }[];
  urgent: boolean;
  extras: string[];
  note: string;
}

export const emptyLine = (): OfferValues["lines"][number] => ({ product: "", quantity: 1, unitPrice: null });
export const emptyOffer = (): OfferValues => ({ customerId: null, title: {}, deliveryOn: null, channel: null, lines: [emptyLine()], urgent: false, extras: [], note: "" });

export const VAT_RATE = 0.25;

/** The running totals: derived in the feature, from the draft, for the summary beside the form. The library knows nothing of offers. */
export function offerTotals(values: Pick<OfferValues, "lines">): { net: number; vat: number; total: number; lines: number } {
  const net = values.lines.reduce((sum, line) => sum + (line.quantity ?? 0) * (line.unitPrice ?? 0), 0);
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  return { net, vat, total: net + vat, lines: values.lines.filter((line) => line.product.trim() !== "").length };
}

export interface OfferWords {
  required: string;
  customer: string;
  title: string;
  channel: string;
  quantity: string;
  price: string;
  noLines: string;
}

/** The offer's schema: its issues carry dotted paths into `lines`, which land on the fields of that line. */
export const offerValidator = (words: OfferWords): FormValidator<OfferInput> => ({
  safeParse(input) {
    const values = input as OfferValues;
    const issues: { path: (string | number)[]; message: string }[] = [];
    if (values.customerId === null) issues.push({ path: ["customerId"], message: words.customer });
    if (missingLocales(values.title, ["hr"]).length > 0) issues.push({ path: ["title"], message: words.title });
    if (values.channel === null) issues.push({ path: ["channel"], message: words.channel });
    if (values.lines.length === 0) issues.push({ path: ["lines"], message: words.noLines });
    values.lines.forEach((line, index) => {
      if (line.product.trim() === "") issues.push({ path: ["lines", index, "product"], message: words.required });
      if (line.quantity === null || line.quantity < 1) issues.push({ path: ["lines", index, "quantity"], message: words.quantity });
      if (line.unitPrice === null || line.unitPrice <= 0) issues.push({ path: ["lines", index, "unitPrice"], message: words.price });
    });
    if (issues.length > 0) return { success: false, error: { issues } };
    return {
      success: true,
      data: {
        customerId: values.customerId as number,
        title: values.title,
        deliveryOn: values.deliveryOn,
        channel: values.channel as "email" | "phone",
        lines: values.lines.map((line) => ({ product: line.product.trim(), quantity: line.quantity as number, unitPrice: line.unitPrice as number })),
        urgent: values.urgent,
        extras: values.extras,
        note: values.note.trim(),
      },
    };
  },
});

/** The create payload: the endpoint's names and shape, stated here and nowhere else. */
export const offerBody = (input: OfferInput): OfferBody => ({
  customer_id: input.customerId,
  title: input.title,
  delivery_on: input.deliveryOn,
  channel: input.channel,
  lines: input.lines.map((line) => ({ product: line.product, quantity: line.quantity, unit_price: line.unitPrice })),
  urgent: input.urgent,
  extras: input.extras,
  note: input.note,
});
