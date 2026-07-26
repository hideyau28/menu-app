import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://travel-tools.zeabur.app"),
  title: "旅程記帳",
  description: "多人旅行記帳與自動結算工具，支援多幣種換算",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "zh_HK",
    siteName: "旅程記帳",
    title: "旅程記帳｜多人旅行分帳工具",
    description: "一齊去旅行，分帳唔使煩。支援多人分帳、多幣種同自動結算。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "旅程記帳多人旅行分帳工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "旅程記帳｜多人旅行分帳工具",
    description: "一齊去旅行，分帳唔使煩。支援多人分帳、多幣種同自動結算。",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    title: "旅程記帳",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
      >
        <Providers>
          <main className="min-h-screen pb-safe">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
