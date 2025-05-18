import "@/styles/globals.css";
import { Metadata, Viewport } from "next";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Equity Simulator",
  description: "Equity Simulator",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="bg-gray-50" suppressHydrationWarning>
        <Providers>
          <main className="w-full mx-auto flex-grow">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
