import type { Metadata } from "next";
import { Space_Grotesk, Syne } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://generatevidiokling.netlify.app"),
  title: "AI Video Studio - Next-Gen Video Generation",
  description: "Create stunning AI-powered videos instantly with AI Video Studio. Professional, fast, and futuristic video generation at your fingertips.",
  openGraph: {
    title: "AI Video Studio",
    description: "Create stunning AI-powered videos instantly. Professional, fast, and futuristic video generation.",
    url: "https://generatevidiokling.netlify.app/",
    siteName: "AI Video Studio",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Studio",
    description: "Create stunning AI-powered videos instantly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${syne.variable}`}>
      <body>{children}</body>
    </html>
  );
}
