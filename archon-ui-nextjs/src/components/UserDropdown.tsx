"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from "flowbite-react";
import { HiCog, HiLogout, HiLogin } from "react-icons/hi";
import { useAuthStore, useUser } from "@/store/useAuthStore";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";

/**
 * UserDropdown component following Flowbite design language
 * Matches SportERP's Header/UserDropdown pattern
 *
 * Features:
 * - Shows "Sign In" button when not authenticated
 * - Shows avatar dropdown when authenticated
 * - Logout confirmation modal
 * - Profile image with fallback to initials
 */
export function UserDropdown() {
  const user = useUser();
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [openLogoutConfirm, setOpenLogoutConfirm] = useState(false);

  // Generate avatar fallback from user name or email
  const getInitials = () => {
    if (!user) return "U";
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };

  // Profile image component with fallback
  const profileImageComponent = useMemo(() => {
    if (!user?.avatar) {
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
          {getInitials()}
        </div>
      );
    }

    return (
      <ImageWithFallback
        src={user.avatar}
        alt={user.name || user.email}
        width={100}
        height={100}
        className="h-10 w-10 rounded-full object-cover"
        fallback={
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
            {getInitials()}
          </div>
        }
      />
    );
  }, [user]);

  const handleLogout = () => {
    console.log("[UserDropdown] Logging out...");

    // Clear auth state
    logout();

    // Close modal
    setOpenLogoutConfirm(false);

    // Force clear localStorage (in case zustand persist didn't clear)
    if (typeof window !== "undefined") {
      localStorage.removeItem("archon-auth-storage");
      localStorage.removeItem("archon_token");
    }

    // Redirect to login
    router.push("/login");

    // Force reload to clear any cached state
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
  };

  // If not authenticated, show Sign In button
  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <HiLogin className="h-5 w-5" />
        Sign In
      </button>
    );
  }

  // Authenticated user - show Flowbite dropdown
  return (
    <>
      <Dropdown
        className="w-56 rounded"
        arrowIcon={false}
        inline
        label={
          <span className="flex w-10 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
            {profileImageComponent}
          </span>
        }
      >
        <DropdownHeader>
          <p className="truncate text-base font-bold text-black dark:text-white">
            {user.name || "User"}
          </p>
          <span className="truncate text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </span>
        </DropdownHeader>
        <DropdownDivider />
        <DropdownItem
          className="rounded-lg text-gray-500 hover:text-black dark:hover:text-white"
          icon={HiCog}
          href="/settings/profile"
        >
          Settings
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem
          className="rounded-lg font-medium text-gray-500 hover:text-brand-700"
          icon={HiLogout}
          onClick={() => {
            console.log("[UserDropdown] Sign out clicked");
            setOpenLogoutConfirm(true);
          }}
        >
          Sign out
        </DropdownItem>
      </Dropdown>

      {/* Logout Confirmation Modal */}
      {openLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50"
          onClick={() => {
            console.log("[UserDropdown] Modal closed");
            setOpenLogoutConfirm(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenLogoutConfirm(false)}
              className="absolute right-2.5 top-3 ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="text-center">
              <HiLogout className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
              <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                Are you sure you want to sign out?
              </h3>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800"
                >
                  Yes, sign out
                </button>
                <button
                  onClick={() => setOpenLogoutConfirm(false)}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white dark:focus:ring-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
