import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedAgent — Emergency medical access by text",
  description:
    "Messaging-first agent for cross-border emergency care on the island of Ireland. Clinicians text. Patients consent. Solana audits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
