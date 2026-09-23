import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EVAWAVE",
  applicationName: "EVAWAVE",
  description:
    "EVAWAVE composes, lints, versions and compiles musical intent into AI music engine input fields. A VASEY/AI tool. Pre-alpha.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
