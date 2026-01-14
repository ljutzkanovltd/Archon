"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { HiMail, HiCheckCircle, HiX, HiEye, HiEyeOff } from "react-icons/hi";

export function ChangeEmailForm() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    new_email: "",
    password: "",
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
    if (!formData.new_email) {
      setError("New email address is required");
      return;
    }

    if (!formData.password) {
      setError("Password is required to change your email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.new_email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if new email is same as current
    if (user && formData.new_email.toLowerCase() === user.email.toLowerCase()) {
      setError("New email must be different from your current email");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:8181/api/auth/users/me/change-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_email: formData.new_email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to initiate email change");
      }

      setSuccess(true);
      setFormData({
        new_email: "",
        password: "",
      });

      // Keep success message visible longer
      setTimeout(() => setSuccess(false), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change email");
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
            <div>
              <strong>Verification email sent!</strong>
              <p className="mt-1">Please check your inbox at <strong>{formData.new_email}</strong> and click the verification link to complete the email change.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Change Email Address
        </h3>

        {/* Current Email Display */}
        {user && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Email
            </p>
            <p className="mt-1 text-base text-gray-900 dark:text-white">
              {user.email}
            </p>
          </div>
        )}

        {/* New Email Input */}
        <div>
          <label htmlFor="new_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New Email Address
          </label>
          <input
            type="email"
            id="new_email"
            value={formData.new_email}
            onChange={(e) => handleChange("new_email", e.target.value)}
            placeholder="newemail@example.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            You'll need to verify this email address before the change takes effect
          </p>
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="Enter your current password"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <HiEyeOff className="h-5 w-5" />
              ) : (
                <HiEye className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Confirm your identity by entering your current password
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How email change works:
        </h4>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
          <li>• We'll send a verification link to your new email address</li>
          <li>• Your current email will remain active until you verify</li>
          <li>• The verification link expires in 1 hour</li>
          <li>• You can still use your account during this process</li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setFormData({ new_email: "", password: "" })}
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
              Sending Verification...
            </>
          ) : (
            <>
              <HiMail className="h-5 w-5" />
              Send Verification Email
            </>
          )}
        </button>
      </div>
    </form>
  );
}
