import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const themeBoot = `(function(){try{var saved=localStorage.getItem("theme");var root=document.documentElement.classList;if(saved==="light"){root.remove("dark");root.add("light");}else{root.remove("light");root.add("dark");}}catch(e){}})();`;

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} ${bebasNeuePro.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
