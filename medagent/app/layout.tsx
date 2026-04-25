import type { Metadata } from "next";
import Link from "next/link";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "MedAgent",
  description:
    "Cross-border emergency medical access with tiered consent and on-chain audit trails on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${jetbrainsMono.variable} min-h-screen`}>
        <nav className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-md">
          <div className="container flex h-14 items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
              MedAgent
            </Link>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/audit/sarah-bennett" className="transition hover:text-foreground">Audit</Link>
            </div>
          </div>
        </nav>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
