"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { HiLockClosed, HiEye, HiEyeOff, HiCheckCircle, HiX } from "react-icons/hi";

export function ChangePasswordForm() {
  const token = useAuthStore((state) => state.token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.current_password) {
      setError("Current password is required");
      return;
    }

    if (!formData.new_password) {
      setError("New password is required");
      return;
    }

    if (formData.new_password.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError("New passwords do not match");
      return;
    }

    if (formData.current_password === formData.new_password) {
      setError("New password must be different from current password");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:8181/api/auth/users/me/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: formData.current_password,
          new_password: formData.new_password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to change password");
      }

      setSuccess(true);
      setFormData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-center gap-2">
            <HiX className="h-5 w-5" />
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <div className="flex items-center gap-2">
            <HiCheckCircle className="h-5 w-5" />
            Password changed successfully!
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Change Password
        </h3>

        <div>
          <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              id="current_password"
              value={formData.current_password}
              onChange={(e) => handleChange("current_password", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showCurrentPassword ? (
                <HiEyeOff className="h-5 w-5" />
              ) : (
                <HiEye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              id="new_password"
              value={formData.new_password}
              onChange={(e) => handleChange("new_password", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showNewPassword ? (
                <HiEyeOff className="h-5 w-5" />
              ) : (
                <HiEye className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Must be at least 8 characters long
          </p>
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirm_password"
              value={formData.confirm_password}
              onChange={(e) => handleChange("confirm_password", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showConfirmPassword ? (
                <HiEyeOff className="h-5 w-5" />
              ) : (
                <HiEye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Password Requirements */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Password Requirements:
        </h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <span className={formData.new_password.length >= 8 ? "text-green-600 dark:text-green-400" : ""}>
              • At least 8 characters
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={/[A-Z]/.test(formData.new_password) ? "text-green-600 dark:text-green-400" : ""}>
              • At least one uppercase letter
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={/[a-z]/.test(formData.new_password) ? "text-green-600 dark:text-green-400" : ""}>
              • At least one lowercase letter
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className={/\d/.test(formData.new_password) ? "text-green-600 dark:text-green-400" : ""}>
              • At least one number
            </span>
          </li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setFormData({ current_password: "", new_password: "", confirm_password: "" })}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Changing Password...
            </>
          ) : (
            <>
              <HiLockClosed className="h-5 w-5" />
              Change Password
            </>
          )}
        </button>
      </div>
    </form>
  );
}
