import localFont from "next/font/local";
import { Inter } from "next/font/google";

export const neueMontreal = localFont({
  src: [
    { path: "../public/fonts/PPNeueMontreal-Book.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Regular.ttf", weight: "450", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Italic.ttf", weight: "450", style: "italic" },
    { path: "../public/fonts/PPNeueMontreal-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const khInterference = localFont({
  src: [
    { path: "../public/fonts/KHInterference-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/KHInterference-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
