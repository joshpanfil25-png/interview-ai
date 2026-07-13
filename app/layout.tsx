import type { Metadata } from "next";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "./globals.css";

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
      <body className="text-ink min-h-screen">
        {children}
      </body>
    </html>
  );
}
