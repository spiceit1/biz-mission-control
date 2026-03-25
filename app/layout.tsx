import type { Metadata } from "next";
import "./globals.css";

const isBiz = process.env.NEXT_PUBLIC_INSTANCE === "biz";

export const metadata: Metadata = {
  title: isBiz ? "Mission Control — Business" : "Mission Control",
  description: isBiz ? "Business Command Center" : "Douglas & Mr. Shmack — Command Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
