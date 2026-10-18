/**
 * Bangla number, price and date formatting.
 *
 * Written by hand instead of leaning on Intl so the server and every browser
 * (including old Android WebViews) produce exactly the same text.
 */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export const TAKA = "৳";

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Replaces ASCII digits with Bangla digits; everything else is left alone. */
export function toBnDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)]);
}

/** Converts Bangla digits a user typed back to ASCII digits. */
export function fromBnDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String(BN_DIGITS.indexOf(digit)));
}

/** South Asian grouping: 12,50,000 rather than 1,250,000. */
function groupSouthAsian(integerDigits: string): string {
  if (integerDigits.length <= 3) return integerDigits;
  const lastThree = integerDigits.slice(-3);
  const rest = integerDigits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`;
}

/** Rounds to a fixed number of decimals and drops trailing zeros. */
function trimDecimals(value: number, maxDecimals: number): string {
  return value
    .toFixed(maxDecimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatNumberBn(value: number, maxDecimals = 0): string {
  const [integerPart, decimalPart] = trimDecimals(Math.abs(value), maxDecimals).split(".");
  const grouped = groupSouthAsian(integerPart);
  const sign = value < 0 ? "-" : "";
  return toBnDigits(decimalPart ? `${sign}${grouped}.${decimalPart}` : `${sign}${grouped}`);
}

/**
 * A price the way people say it in Bangladesh:
 * 12500000 → "১.২৫ কোটি", 8500000 → "৮৫ লাখ", 45000 → "৪৫,০০০".
 */
export function formatAmountBn(amount: number): string {
  if (amount >= CRORE) {
    return `${toBnDigits(trimDecimals(amount / CRORE, 2))} কোটি`;
  }
  if (amount >= LAKH) {
    return `${toBnDigits(trimDecimals(amount / LAKH, 2))} লাখ`;
  }
  return formatNumberBn(Math.round(amount));
}

export function formatPriceBn(amount: number): string {
  return `${TAKA} ${formatAmountBn(amount)}`;
}

export function formatPercentBn(value: number, maxDecimals = 1): string {
  return `${toBnDigits(trimDecimals(value, maxDecimals))}%`;
}

const DAY_MS = 86_400_000;

export function daysBetween(earlier: Date | string, later: Date | string): number {
  const start = new Date(earlier).getTime();
  const end = new Date(later).getTime();
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/** "আজ", "গতকাল", "৫ দিন আগে", "৩ সপ্তাহ আগে", "২ মাস আগে". */
export function formatDaysAgoBn(days: number): string {
  if (days <= 0) return "আজ";
  if (days === 1) return "গতকাল";
  if (days < 14) return `${toBnDigits(days)} দিন আগে`;
  if (days < 60) return `${toBnDigits(Math.floor(days / 7))} সপ্তাহ আগে`;
  if (days < 365) return `${toBnDigits(Math.floor(days / 30))} মাস আগে`;
  return `${toBnDigits(Math.floor(days / 365))} বছর আগে`;
}

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

/** Bangladesh is UTC+6 all year, so a fixed shift gives the local calendar date. */
const DHAKA_OFFSET_MS = 6 * 3_600_000;

/** "৮ অক্টোবর ২০২৬", in Bangladesh time. */
export function formatDateBn(value: Date | string): string {
  const local = new Date(new Date(value).getTime() + DHAKA_OFFSET_MS);
  return `${toBnDigits(local.getUTCDate())} ${BN_MONTHS[local.getUTCMonth()]} ${toBnDigits(local.getUTCFullYear())}`;
}

/**
 * Adds the Bangla locative ending to a place name:
 * ঢাকা → ঢাকায়, মিরপুর → মিরপুরে, ধানমন্ডি → ধানমন্ডিতে.
 */
export function inLocationBn(name: string): string {
  const trimmed = name.trim();
  const last = trimmed.slice(-1);
  if (!/[ঀ-৿]/.test(last)) return `${trimmed}-এ`;
  if (last === "া") return `${trimmed}য়`;
  if (last === "ঁ") return `${trimmed}য়`;
  if ("িীুূৃেৈোৌইঈউঊএঐওঔ".includes(last)) return `${trimmed}তে`;
  if (last === "আ") return `${trimmed}য়`;
  return `${trimmed}ে`;
}

/**
 * Adds the Bangla possessive ending to a place name:
 * ঢাকা → ঢাকার, মিরপুর → মিরপুরের, ধানমন্ডি → ধানমন্ডির.
 */
export function ofLocationBn(name: string): string {
  const trimmed = name.trim();
  const last = trimmed.slice(-1);
  if (!/[ঀ-৿]/.test(last)) return `${trimmed}-এর`;
  if ("ািীুূৃেৈোৌঅআইঈউঊএঐওঔ".includes(last)) return `${trimmed}র`;
  return `${trimmed}ের`;
}
