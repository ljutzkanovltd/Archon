"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiCog, HiLogout } from "react-icons/hi";
import { useAuthStore, useUser } from "@/store/useAuthStore";

export function UserDropdown() {
  const user = useUser();
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Generate avatar fallback from user name or email
  const getAvatarFallback = () => {
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

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    router.push("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="relative">
        {/* Avatar Button */}
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          aria-label="User menu"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || user.email}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
              {getAvatarFallback()}
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />

            {/* Dropdown Content */}
            <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
              {/* User Info Header */}
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-600">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user.name || "User"}
                </p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/settings/profile"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <HiCog className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowLogoutModal(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <HiLogout className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <>
          {/* Modal Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-gray-900/50 dark:bg-gray-900/80"
            onClick={() => setShowLogoutModal(false)}
          />

          {/* Modal Content */}
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform">
            <div className="relative rounded-lg bg-white shadow-xl dark:bg-gray-800">
              {/* Modal Header */}
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="absolute right-2.5 top-2.5 ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Modal Body */}
              <div className="p-6 text-center">
                <HiLogout className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                  Are you sure you want to sign out?
                </h3>
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg bg-red-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800"
                  >
                    Yes, sign out
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white dark:focus:ring-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
