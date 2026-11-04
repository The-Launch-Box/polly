import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const bebasNeuePro = localFont({
  src: "../../launch-box-wordmark/fonts/BebasNeuePro-BoldItalic.otf",
  variable: "--font-bebas",
  weight: "700",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Polly",
  description: "Polly, The Launch Box's internal survey tool for portfolio companies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable} ${bebasNeuePro.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
