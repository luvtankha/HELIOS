import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HELIOS | Healthcare pre-consultation",
  description: "AI-assisted pre-consultation and clinical case-taking.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
