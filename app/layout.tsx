import type { Metadata } from "next";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://runback.app'),
  title: "Runback — Run it back till it's easy",
  description:
    "Unlimited AI mock interviews built from your resume. Runback tailors real interview questions to your experience, scores your answers, and lets you run it back until the real one feels easy. Free for students.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    type: 'website',
    url: 'https://runback.app',
    siteName: 'Runback',
    title: "Runback — Run it back till it's easy",
    description:
      "Unlimited AI mock interviews built from your resume. Get grilled, get scored, and run it back until the real one feels like a scrimmage.",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Runback — the interview before the interview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Runback — Run it back till it's easy",
    description:
      "Unlimited AI mock interviews built from your resume. Get grilled, get scored, and run it back until the real one feels like a scrimmage.",
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-ink min-h-screen">
        {children}
      </body>
    </html>
  );
}
