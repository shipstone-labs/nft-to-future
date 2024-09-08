import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import clx from "classnames";
import { appConfig } from "./config.mjs";
import PlausibleProvider from "next-plausible";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: appConfig.themeColor,
};

export const metadata = {
  title: appConfig.appName,
  icons: {
    icon: appConfig.icons,
  },
  applicationName: appConfig.appName,
  other: appConfig.msapplication,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PlausibleProvider domain="nft-to-the-future.shipstone.com">
      <html lang="en">
        <body className={inter.className}>
          <div className="background text-gray-900" />
          {children}
        </body>
      </html>
    </PlausibleProvider>
  );
}
