import type { Metadata } from "next";
import "./globals.css";
import { neueMontreal, inter, khInterference } from "./fonts";

export const metadata: Metadata = {
  title: "XXX",
  description: "Inquire Within.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${neueMontreal.variable} ${inter.variable} ${khInterference.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
