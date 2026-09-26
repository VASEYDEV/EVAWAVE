import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

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
  themeColor: "#07090d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          <h1>EVAWAVE</h1>
          <p>Compose musical intent once; compile it for Suno, ElevenLabs Music and Google Flow Music. Pre-alpha.</p>
          <nav aria-label="Site">
            <ul>
              <li>
                <Link href="/">Composer</Link>
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
