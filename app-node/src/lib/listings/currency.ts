/**
 * Currency / range string helpers for the native pricing table.
 *
 * Inlined verbatim from app/javascript/modules/listings/DirectoryHelpers.tsx.
 * We can't import that module into the SSR render path: it imports routeUtil,
 * whose top-level SignInRedirectUrls reads window.location at module eval and
 * crashes server rendering (same trap as AppShell). These two helpers are pure.
 */
import { t } from "@uic"

/** Return true for 0, but false for null or undefined. */
const isNumber = (val: number) => val || val === 0

export const getCurrencyString = (currencyNumber: number): string | null => {
  const fractionDigits = Number.isInteger(currencyNumber) ? 0 : 2
  return currencyNumber || currencyNumber === 0
    ? currencyNumber.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
      })
    : null
}

const getNumberString = (num: number, currency?: boolean): string | null =>
  num || num === 0 ? (currency ? getCurrencyString(num) : num.toLocaleString()) : null

export const getRangeString = (
  min: number,
  max: number,
  currency?: boolean,
  suffix?: string,
  forceZeroInRange = false
): string | null => {
  if (isNumber(min) && isNumber(max) && min <= 0 && max !== 0 && !forceZeroInRange) {
    const maxString = getNumberString(max, currency)
    return `${t("t.upTo")} ${maxString}`
  }
  if (isNumber(min) && isNumber(max) && min !== max) {
    const minString = getNumberString(forceZeroInRange ? 0 : min, currency)
    const maxString = getNumberString(max, currency)
    const range = t("t.numberRange", { minValue: minString, maxValue: maxString })
    return `${range}${suffix ?? ""}`
  }
  if (isNumber(min) || isNumber(max)) {
    return `${getNumberString(min ?? max, currency)}${suffix ?? ""}`
  }
  return null
}
