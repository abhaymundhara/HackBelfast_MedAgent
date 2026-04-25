import type { Metadata } from "next";
import Link from "next/link";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { Navbar } from "@/components/app/navbar";
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
    "AI-powered emergency medical record access with tiered consent and tamper-proof audit.",
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
              <Link href="/clinician" className="transition hover:text-foreground">Clinician</Link>
              <Link href="/patient" className="transition hover:text-foreground">Patient</Link>
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
