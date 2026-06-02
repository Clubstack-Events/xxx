import type { Metadata } from "next";
import "./globals.css";
import { neueMontreal, inter, khInterference } from "./fonts";

export const metadata: Metadata = {
  title: "DITP — June 6 Fort Tilden",
  description: "Book your transportation to the June 6 event at Fort Tilden.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${neueMontreal.variable} ${inter.variable} ${khInterference.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
