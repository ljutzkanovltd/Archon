"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "flowbite-react";
import { HiBell, HiEye, HiCheckCircle } from "react-icons/hi";
import { useNotificationStore } from "@/store/useNotificationStore";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";

// Import dayjs for relative time formatting
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

/**
 * NotificationBellDropdown component following SportERP's Flowbite design language
 * Matches SportERP's NotificationDropdown pattern
 *
 * Features:
 * - Bell icon with unread badge counter
 * - Dropdown with notification list
 * - "Mark all as read" and "View all" actions
 * - Relative timestamps using dayjs
 * - Avatar fallbacks for notification senders
 */
export function NotificationBellDropdown() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle notification click
  const handleNotificationClick = (notification: { id: string; link?: string; is_read: boolean }) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <Dropdown
      className="w-fit rounded"
      arrowIcon={false}
      inline
      label={
        <span className="relative cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
          <span className="sr-only">Notifications</span>
          <HiBell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute left-5 top-5 flex h-4.5 w-4.5 items-center justify-center rounded-xl bg-brand-500 p-0.5 text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
      }
      theme={{ content: "py-0" }}
    >
      <div className="min-w-72 max-w-xs md:min-w-80 md:max-w-sm">
        {/* Header */}
        <div className="block rounded-t-xl bg-gray-50 px-4 py-2 text-center text-base font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          Notifications
        </div>

        {/* Notification List */}
        {notifications.length > 0 ? (
          <div className="max-h-80 overflow-y-auto md:max-h-96">
            {notifications.map((notification) => {
              const timeAgo = dayjs.utc(notification.created_at).fromNow();

              // Generate initials from user name
              const getInitials = () => {
                if (!notification.user_name) return "?";
                return notification.user_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
              };

              // Notification type colors
              const getTypeColor = () => {
                switch (notification.type) {
                  case "success":
                    return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
                  case "error":
                    return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
                  case "warning":
                    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
                  case "task":
                    return "bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400";
                  default:
                    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
                }
              };

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="relative flex w-full cursor-pointer border-y border-gray-200 px-4 py-3 text-left hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand-700/70" />
                  )}

                  {/* Avatar */}
                  <div className="shrink-0">
                    {notification.user_avatar ? (
                      <ImageWithFallback
                        src={notification.user_avatar}
                        alt={notification.user_name || "User"}
                        width={48}
                        height={48}
                        className="h-10 w-10 rounded-full border object-cover md:h-12 md:w-12"
                        fallback={
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border p-1 text-xs font-medium md:h-12 md:w-12 ${getTypeColor()}`}
                          >
                            {getInitials()}
                          </div>
                        }
                      />
                    ) : (
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border p-1 text-xs font-medium md:h-12 md:w-12 ${getTypeColor()}`}
                      >
                        {getInitials()}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="w-full pl-3">
                    <div className="mb-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">
                      {notification.user_name && (
                        <>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {notification.user_name}
                          </span>
                          {": "}
                        </>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </span>
                      {notification.message && (
                        <>
                          {" - "}
                          {notification.message}
                        </>
                      )}
                    </div>
                    <div className="text-xs font-medium text-brand-700 dark:text-brand-400">
                      {timeAgo}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-3">
            <p className="text-gray-500 dark:text-gray-400">No New Notifications</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-around border-t border-gray-200 py-2 dark:border-gray-700">
          <button
            onClick={() => router.push("/notifications")}
            className="flex items-center gap-x-2 rounded-lg p-2 text-center text-base font-normal text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiEye className="h-5 w-5" />
            <span>View all</span>
          </button>
          <button
            onClick={() => markAllAsRead()}
            disabled={notifications.length === 0 || unreadCount === 0}
            className="flex items-center gap-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiCheckCircle className="h-5 w-5" />
            <span>Mark all as read</span>
          </button>
        </div>
      </div>
    </Dropdown>
  );
}
