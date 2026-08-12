import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "نظام مراجعة لنظام الجودة QMS | QMS Audit System",
  description:
    "نظام إدارة المراجعة الداخلية للجودة - شركة الكابلات السعودية | Internal quality audit management - Saudi Cable Company",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions routinely add classes and
          attributes to <body> before React hydrates, which React reports as a
          mismatch even though the app's own markup is identical on both sides. */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
