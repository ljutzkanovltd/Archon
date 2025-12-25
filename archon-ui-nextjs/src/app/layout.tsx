import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProgressBar } from "@/components/ProgressBar";
import { DesktopSidebar, MobileSidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <SettingsProvider>
              <SidebarProvider>
                <div className="flex h-screen flex-col">
                  <Header />
                  <Suspense fallback={null}>
                    <ProgressBar />
                  </Suspense>
                  <div className="flex flex-1 items-start overflow-hidden">
                    <DesktopSidebar />
                    <MobileSidebar />
                    <div className="relative flex h-full w-full flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
                      <ErrorBoundary>
                        <div
                          id="main-content"
                          className="relative h-full w-full overflow-y-auto"
                        >
                          {children}
                        </div>
                      </ErrorBoundary>
                      <Footer />
                    </div>
                  </div>
                </div>
              </SidebarProvider>
            </SettingsProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
