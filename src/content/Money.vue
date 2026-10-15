<script setup lang="ts">
import { computed } from "vue";
import { useFormat } from "../format";

/**
 * An amount in major units (12.5 is twelve and a half), in the application's number format and its
 * currency symbol (`createFormatting({ currencySymbol })`). Tabular figures, so digits line up in a
 * column; the symbol a step quieter than the number. A missing amount reads as zero.
 *
 *   <Money :amount="offer.price" />                 <!-- 12.000,00 € -->
 *   <Money :amount="row.amount" :symbol="false" />  <!-- number only -->
 *   <Money :amount="price" whole empty-zero />      <!-- 39.600 €, and — for null or 0 -->
 *   <Money :amount="correction" signed />           <!-- + 250,00 € in green, − 250,00 € in red -->
 */
const props = withDefaults(defineProps<{
  amount: number | null | undefined;
  /** Show the currency symbol (default true; nothing shows when the application set none). */
  symbol?: boolean;
  /** Fraction digits (default 2). */
  decimals?: number;
  /** Drop the fraction of an amount that has none: "39.600", not "39.600,00". */
  whole?: boolean;
  /** Show "—" for null or 0: a missing price, not a free item. */
  emptyZero?: boolean;
  /** A change rather than an amount: "+" and green when it raises, "−" and red when it lowers, plain at 0. */
  signed?: boolean;
}>(), { symbol: true, decimals: 2, whole: false, emptyZero: false, signed: false });

const format = useFormat();

const value = computed(() => (typeof props.amount === "number" && Number.isFinite(props.amount) ? props.amount : 0));
const isEmpty = computed(() => props.emptyZero && !value.value);
const sign = computed(() => {
  if (!props.signed || !value.value) return "";
  // What rounds to zero is shown unsigned.
  if (!Math.round(Math.abs(value.value) * 10 ** props.decimals)) return "";
  return value.value > 0 ? "+" : "−";
});
const text = computed(() => {
  const digits = props.whole && Number.isInteger(value.value) ? 0 : props.decimals;
  return format.number(props.signed ? Math.abs(value.value) : value.value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
});
// The whole figure takes the colour, as a stock ticker colours a change: a sign alone is too thin to carry it.
const tone = computed(() => (sign.value === "+" ? "font-medium text-status-success-content" : sign.value === "−" ? "font-medium text-status-danger-content" : ""));
const currencySymbol = computed(() => (props.symbol ? format.currencySymbol : ""));
</script>

<template>
  <span class="whitespace-nowrap tabular-nums" :class="tone">
    <template v-if="isEmpty">—</template>
    <template v-else>
      <span v-if="sign" class="mr-0.5">{{ sign }}</span>{{ text }}<span v-if="currencySymbol" class="ml-1 font-normal" :class="tone ? 'opacity-75' : 'text-content-muted'">{{ currencySymbol }}</span>
    </template>
  </span>
</template>
