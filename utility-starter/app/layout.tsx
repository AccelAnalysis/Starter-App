import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utility Starter",
  description: "A focused starter for small calculation, display, filtering, and transformation apps.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
