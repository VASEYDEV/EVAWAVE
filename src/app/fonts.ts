/**
 * The three typefaces of the Vasey Multimedia Brand System v2.0 (§06: three families,
 * closed), self-hosted from src/fonts under the SIL Open Font License, so the build needs no
 * network and no third party sees a request. Each exposes a CSS variable that
 * src/app/styles/tokens.css maps onto the --font, --font-display and --mono roles.
 */
import localFont from "next/font/local";

/** Interface and body: Reddit Sans, variable 200–900. 400 body, 600 headings, 700 labels. */
export const sans = localFont({
  src: "../fonts/RedditSans-Variable.woff2",
  weight: "200 900",
  display: "swap",
  variable: "--font-sans",
});

/** Display: Bebas Neue, one weight, all caps. Headlines, kickers and lockups; never body. */
export const bebas = localFont({
  src: "../fonts/BebasNeue-Regular.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-bebas",
});

/**
 * Technical: JetBrains Mono, variable 100–800, for values read as data (BPM, key, bar math,
 * hex, JSON). Ligatures are off in the interface, as the guide requires.
 */
export const jetbrains = localFont({
  src: "../fonts/JetBrainsMono-Variable.woff2",
  weight: "100 800",
  display: "swap",
  variable: "--font-jetbrains",
  declarations: [{ prop: "font-feature-settings", value: "'liga' 0, 'calt' 0" }],
});
