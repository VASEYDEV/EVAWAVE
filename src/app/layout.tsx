import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { bebas, jetbrains, sans } from "./fonts";

// Cascade order: tokens, then the document, the type scale, components, pages.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/type.css";
import "./styles/components.css";
import "./styles/pages.css";

export const metadata: Metadata = {
  title: "EVAWAVE",
  applicationName: "EVAWAVE",
  description:
    "EVAWAVE composes, lints, versions and compiles musical intent into AI music engine input fields. A VASEY/AI tool. Pre-alpha.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  // Deep Turquoise, the brand's native field (Vasey Multimedia Brand System v2.0 §03).
  themeColor: "#052e3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${bebas.variable} ${jetbrains.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          {/* The entity lockup (ADR 0005): the slash is BEAM, the page's one signature use. */}
          <p className="kicker">
            VASEY<span className="beam">/</span>AI
          </p>
          <h1 className="wordmark">EVAWAVE</h1>
          <p className="tagline">Compose musical intent once; compile it for Suno, ElevenLabs Music and Google Flow Music. Pre-alpha.</p>
          <nav aria-label="Site">
            <ul>
              <li>
                <Link href="/">Composer</Link>
              </li>
              <li>
                <Link href="/import">Import</Link>
              </li>
              <li>
                <Link href="/library">Library</Link>
              </li>
            </ul>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
