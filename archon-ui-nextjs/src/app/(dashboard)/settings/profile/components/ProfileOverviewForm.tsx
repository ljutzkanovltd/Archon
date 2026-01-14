"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { HiSave, HiX } from "react-icons/hi";
import { AvatarUpload } from "./AvatarUpload";

interface ProfileData {
  full_name: string;
  bio: string;
  company: string;
  job_title: string;
  location: string;
  timezone: string;
  language: string;
  theme_preference: string;
  email_notifications: boolean;
  push_notifications: boolean;
  phone_number: string;
  github_url: string;
  linkedin_url: string;
  twitter_url: string;
  website_url: string;
  avatar_url: string;
}

export function ProfileOverviewForm() {
  const token = useAuthStore((state) => state.token);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<Partial<ProfileData>>({
    full_name: "",
    bio: "",
    company: "",
    job_title: "",
    location: "",
    timezone: "UTC",
    language: "en",
    theme_preference: "light",
    email_notifications: true,
    push_notifications: false,
    phone_number: "",
    github_url: "",
    linkedin_url: "",
    twitter_url: "",
    website_url: "",
    avatar_url: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8181/api/auth/users/me/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile({
        full_name: data.full_name || "",
        bio: data.bio || "",
        company: data.company || "",
        job_title: data.job_title || "",
        location: data.location || "",
        timezone: data.timezone || "UTC",
        language: data.language || "en",
        theme_preference: data.theme_preference || "light",
        email_notifications: data.email_notifications ?? true,
        push_notifications: data.push_notifications ?? false,
        phone_number: data.phone_number || "",
        github_url: data.github_url || "",
        linkedin_url: data.linkedin_url || "",
        twitter_url: data.twitter_url || "",
        website_url: data.website_url || "",
        avatar_url: data.avatar_url || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("http://localhost:8181/api/auth/users/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string | boolean) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
        <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
        <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            <HiSave className="h-5 w-5" />
            Profile updated successfully!
          </div>
        </div>
      )}

      {/* Avatar Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Profile Picture
        </h3>
        <AvatarUpload
          currentAvatarUrl={profile.avatar_url}
          onAvatarUpdate={(newUrl) => setProfile((prev) => ({ ...prev, avatar_url: newUrl }))}
        />
      </div>

      {/* Personal Information Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Personal Information
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              value={profile.full_name || ""}
              onChange={(e) => handleChange("full_name", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone_number"
              value={profile.phone_number || ""}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              value={profile.bio || ""}
              onChange={(e) => handleChange("bio", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Professional Information Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Professional Information
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company
            </label>
            <input
              type="text"
              id="company"
              value={profile.company || ""}
              onChange={(e) => handleChange("company", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Title
            </label>
            <input
              type="text"
              id="job_title"
              value={profile.job_title || ""}
              onChange={(e) => handleChange("job_title", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              value={profile.location || ""}
              onChange={(e) => handleChange("location", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              value={profile.timezone || "UTC"}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Social Links Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Social Links
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="github_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitHub URL
            </label>
            <input
              type="url"
              id="github_url"
              value={profile.github_url || ""}
              onChange={(e) => handleChange("github_url", e.target.value)}
              placeholder="https://github.com/username"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              id="linkedin_url"
              value={profile.linkedin_url || ""}
              onChange={(e) => handleChange("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="twitter_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Twitter URL
            </label>
            <input
              type="url"
              id="twitter_url"
              value={profile.twitter_url || ""}
              onChange={(e) => handleChange("twitter_url", e.target.value)}
              placeholder="https://twitter.com/username"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Website URL
            </label>
            <input
              type="url"
              id="website_url"
              value={profile.website_url || ""}
              onChange={(e) => handleChange("website_url", e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preferences
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language
            </label>
            <select
              id="language"
              value={profile.language || "en"}
              onChange={(e) => handleChange("language", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>

          <div>
            <label htmlFor="theme_preference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </label>
            <select
              id="theme_preference"
              value={profile.theme_preference || "light"}
              onChange={(e) => handleChange("theme_preference", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.email_notifications ?? true}
              onChange={(e) => handleChange("email_notifications", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable email notifications
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.push_notifications ?? false}
              onChange={(e) => handleChange("push_notifications", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable push notifications
            </span>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <button
          type="button"
          onClick={fetchProfile}
          disabled={isSaving}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Saving...
            </>
          ) : (
            <>
              <HiSave className="h-5 w-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
