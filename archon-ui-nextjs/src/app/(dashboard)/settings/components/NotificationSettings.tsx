"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck } from "react-icons/hi";

export function NotificationSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.notifications || {
    enable_notifications: true,
    crawl_complete_notification: true,
    error_notifications: true,
    notification_sound: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "notifications", data: formData });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Archon Dashboard", {
        body: "This is a test notification",
        icon: "/favicon.ico",
      });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Archon Dashboard", {
            body: "This is a test notification",
            icon: "/favicon.ico",
          });
        }
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">Notification Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="flex items-center cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={formData.enable_notifications}
              onChange={(e) => setFormData({ ...formData, enable_notifications: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Enable Notifications</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Master switch for all browser notifications
          </p>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Notification Types</h3>

          <div className="space-y-4">
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.crawl_complete_notification}
                  onChange={(e) => setFormData({ ...formData, crawl_complete_notification: e.target.checked })}
                  className="mr-3 h-4 w-4"
                  disabled={!formData.enable_notifications}
                />
                <span className="text-sm font-medium dark:text-gray-300">Crawl Complete</span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                Notify when knowledge base crawl operations finish
              </p>
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.error_notifications}
                  onChange={(e) => setFormData({ ...formData, error_notifications: e.target.checked })}
                  className="mr-3 h-4 w-4"
                  disabled={!formData.enable_notifications}
                />
                <span className="text-sm font-medium dark:text-gray-300">Error Notifications</span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                Notify when errors occur during operations
              </p>
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notification_sound}
                  onChange={(e) => setFormData({ ...formData, notification_sound: e.target.checked })}
                  className="mr-3 h-4 w-4"
                  disabled={!formData.enable_notifications}
                />
                <span className="text-sm font-medium dark:text-gray-300">Notification Sound</span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                Play sound when notifications appear
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <button
            onClick={testNotification}
            disabled={!formData.enable_notifications}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 transition-colors"
          >
            Test Notification
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Test browser notifications (will request permission if not granted)
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Browser notifications require permission. You may need to enable them in your browser settings.
            Notifications only work when the dashboard is open in a browser tab.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-brand-700 hover:bg-brand-800 hover:text-white text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>

        {showSuccess && (
          <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <HiCheck className="w-5 h-5" />
            Settings saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}
