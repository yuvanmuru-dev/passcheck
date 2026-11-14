import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Oswald } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-inter" });
const heading = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "PassCheck", template: "%s · PassCheck" },
  description: "Kitchen pass board, order evidence, and delivery dispute review.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${mono.variable}`}>
      <body>
        <Suspense><Navigation /></Suspense>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
