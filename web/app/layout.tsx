import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIGILUM — confidential guardian for FAssets vaults",
  description:
    "A 24/7 confidential guardian for FAssets agents: watches vault health, defends against liquidation, and leaves an attestable on-chain record of every action.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
