import type { Metadata, Viewport } from "next";

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
      <body>{children}</body>
    </html>
  );
}
