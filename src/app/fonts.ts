import localFont from "next/font/local";

/**
 * Anek Bangla (SIL Open Font License, see ./fonts/OFL-LICENSE.txt), self-hosted
 * from the files in @fontsource/anek-bangla 5.3.0,
 * so no request leaves the site and the files are cached with the app.
 *
 * Budget, chosen for slow mobile connections:
 *   two weights only (400 and 700), about 57 KB each for Bengali and 19 KB each
 *   for Latin. The variable version with every weight is 156 KB for Bengali
 *   alone, and the width axis pushes it to 448 KB, so neither is used.
 *
 * Each script is its own file with a unicode-range, so the browser downloads a
 * file only when the page actually contains characters from it.
 *
 * next/font reads these options at build time, so every value must be written
 * out as a literal here (no shared constants).
 */

export const anekBengali = localFont({
  src: [
    { path: "./fonts/anek-bangla-bengali-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/anek-bangla-bengali-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-anek-bengali",
  display: "swap",
  preload: true,
  // Android's built-in Bangla font takes over until this one arrives.
  fallback: ["Noto Sans Bengali", "sans-serif"],
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1",
    },
  ],
});

export const anekLatin = localFont({
  src: [
    { path: "./fonts/anek-bangla-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/anek-bangla-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-anek-latin",
  display: "swap",
  // Spaces and punctuation live here, so it is needed on every page, but it is
  // small and the page is readable without it.
  preload: false,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});
