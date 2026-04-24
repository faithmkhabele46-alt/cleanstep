import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cleanstep",
  description: "Production-ready cleaning service booking flow for shoes, carpets, couches and mattresses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-[#3f363a] flex flex-col">
        <Link
          href="/"
          className="fixed left-4 top-4 z-50 overflow-hidden rounded-2xl border border-[#1f4b8f]/12 bg-white shadow-[0_12px_30px_rgba(31,75,143,0.12)] transition hover:scale-[1.02]"
        >
          <Image
            src="/cleanstep-logo-system.png"
            alt="Cleanstep logo"
            width={88}
            height={88}
            className="h-[68px] w-[68px] object-contain p-1 sm:h-[88px] sm:w-[88px]"
          />
        </Link>
        {children}
      </body>
    </html>
  );
}
