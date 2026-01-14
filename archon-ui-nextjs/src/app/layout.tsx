import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Archon Dashboard",
  description: "Knowledge base and task management for SportERP platform",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

/**
 * Root layout - Minimal providers only
 * Actual layouts (auth vs dashboard) handled by route groups
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <SettingsProvider>{children}</SettingsProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
