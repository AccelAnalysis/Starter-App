import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data-backed Starter",
  description: "A focused starter with Firebase authentication and protected Firestore records.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
