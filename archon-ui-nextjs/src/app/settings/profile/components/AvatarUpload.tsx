"use client";

import { useState, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { HiCamera, HiX, HiCheckCircle } from "react-icons/hi";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onAvatarUpdate?: (newUrl: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, onAvatarUpdate }: AvatarUploadProps) {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate fallback initials
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

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Allow empty URL to clear avatar

    // Basic URL validation
    try {
      new URL(url);

      // Check if it's an image URL (basic check)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const urlLower = url.toLowerCase();

      if (!imageExtensions.some(ext => urlLower.includes(ext)) &&
          !url.includes('gravatar.com') &&
          !url.includes('ui-avatars.com') &&
          !url.includes('cloudinary.com') &&
          !url.includes('imgur.com')) {
        setError("URL should point to an image (jpg, png, gif, webp, or known image service)");
        return false;
      }

      return true;
    } catch {
      setError("Please enter a valid URL");
      return false;
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (!validateUrl(avatarUrl)) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("http://localhost:8181/api/auth/users/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          avatar_url: avatarUrl || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update avatar");
      }

      const data = await response.json();

      // Update user in auth store
      if (user) {
        setUser({
          ...user,
          avatar: data.avatar_url,
        });
      }

      setSuccess(true);
      setIsEditing(false);

      if (onAvatarUpdate) {
        onAvatarUpdate(data.avatar_url);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAvatarUrl(currentAvatarUrl || "");
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
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
            Avatar updated successfully!
          </div>
        </div>
      )}

      <div className="flex items-start gap-6">
        {/* Avatar Preview */}
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="h-24 w-24 rounded-full object-cover"
              onError={() => {
                setError("Failed to load avatar image");
                setAvatarUrl("");
              }}
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-2xl font-medium text-white">
              {getInitials()}
            </div>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-2 text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              aria-label="Change avatar"
            >
              <HiCamera className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Avatar URL Input */}
        {isEditing && (
          <div className="flex-1 space-y-3">
            <div>
              <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Avatar URL
              </label>
              <input
                ref={inputRef}
                type="url"
                id="avatar_url"
                value={avatarUrl}
                onChange={(e) => {
                  setAvatarUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter a direct URL to an image (jpg, png, gif, webp)
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <HiCheckCircle className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>

            {/* Quick Avatar Services */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Quick Options:
              </p>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>• <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Gravatar</a> - Email-based avatars</p>
                <p>• <a href="https://ui-avatars.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">UI Avatars</a> - Generate from initials</p>
                <p>• Or paste any public image URL</p>
              </div>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Profile Avatar
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click the camera icon to change your avatar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
