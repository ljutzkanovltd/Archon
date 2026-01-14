import React from "react";
import { Suspense } from "react";
import { ProgressBar } from "@/components/ProgressBar";

/**
 * Minimal auth layout for login, reset-password, verify-email pages
 * No Header, Sidebar, or Footer - just the page content
 */
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Suspense fallback={null}>
        <ProgressBar />
      </Suspense>
      {children}
    </>
  );
};

export default AuthLayout;
