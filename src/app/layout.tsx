import type { Metadata } from "next";
import "@/index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Study2PR — Internal CRM",
  description:
    "Study2PR internal CRM for licensed Canadian immigration consultants — leads, clients, cases, finance, and workflows.",
  authors: [{ name: "Study2PR" }],
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
  openGraph: {
    type: "website",
    title: "Study2PR — Internal CRM",
    description:
      "Study2PR internal CRM for licensed Canadian immigration consultants — leads, clients, cases, finance, and workflows.",
  },
  twitter: {
    card: "summary",
    title: "Study2PR — Internal CRM",
    description:
      "Study2PR internal CRM for licensed Canadian immigration consultants — leads, clients, cases, finance, and workflows.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* v2 premium pairing: Fraunces (display serif) + Plus Jakarta Sans (body) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
