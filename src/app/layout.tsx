import type { Metadata } from "next";
import { preload } from "react-dom";
import "./globals.css";

// Facility console root. The marketing site (SEO, popups, analytics) lives in sotercare-website.
export const metadata: Metadata = {
  title: { default: "SoterCare Console", template: "%s | SoterCare Console" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  preload("/fonts/URWGeometricMedium.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/URWGeometricBold.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
