import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialProject — Trump Post Trading Engine",
  description: "Real-time Truth Social monitor + Claude AI analysis + automated options trading",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
