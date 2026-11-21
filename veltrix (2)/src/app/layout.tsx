import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VELTRIX · Two-Tier Observability",
  description:
    "Working reference implementation of a two-tier observability architecture where only allowlisted metadata crosses the trust boundary. Tier 1 runs a local collector in the customer environment; Tier 2 is the multi-tenant SaaS that ingests signed metadata, runs Health and AIOps engines, and reconciles egress.",
  keywords: [
    "observability",
    "two-tier",
    "trust boundary",
    "metadata only",
    "HMAC",
    "TLS 1.3",
    "multi-tenant",
    "AIOps",
    "VELTRIX",
  ],
  authors: [{ name: "VELTRIX" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
