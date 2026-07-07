import type { Metadata } from "next";
import { Inter, Archivo } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], weight: ["800", "900"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Runback — Run it back till it's easy",
  description: "Unlimited AI mock interviews built from your resume. Do the reps before the real one.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${archivo.variable} text-ink min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
