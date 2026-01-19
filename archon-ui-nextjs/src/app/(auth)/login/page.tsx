"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore, useIsAuthenticated } from "@/store/useAuthStore";
import {
  Card,
  Label,
  TextInput,
  Button,
  Checkbox,
  Tabs,
} from "flowbite-react";

type LoginMode = "password" | "magic-link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [activeTab, setActiveTab] = useState<LoginMode>("password");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(formData.email, formData.password);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  // Quick demo login handler
  const handleQuickLogin = async (email: string, password: string) => {
    clearError();
    try {
      await login(email, password);
    } catch (err) {
      console.error("Quick login failed:", err);
    }
  };

  const handleMagicLinkSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkError(null);
    setMagicLinkLoading(true);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicLinkEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send magic link");
      }

      setMagicLinkSent(true);
    } catch (err) {
      setMagicLinkError(
        err instanceof Error ? err.message : "Failed to send magic link"
      );
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-brand-600 dark:text-brand-500">
            🏛️ Archon
          </h1>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Knowledge base and task management for SportERP
          </p>
        </div>

        {/* Login Card with Tabs */}
        <Card>
          <Tabs
            aria-label="Login options"
            variant="underline"
            onActiveTabChange={(tab) => {
              setActiveTab(tab === 0 ? "password" : "magic-link");
              clearError();
              setMagicLinkError(null);
              setMagicLinkSent(false);
            }}
          >
            {/* Password Login Tab */}
            <Tabs.Item active title="Password">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                {/* Email Field */}
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="email" value="Email address" />
                  </div>
                  <TextInput
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    color={error ? "failure" : undefined}
                  />
                </div>

                {/* Password Field */}
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="password" value="Password" />
                  </div>
                  <TextInput
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    color={error ? "failure" : undefined}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" />
                    <Label htmlFor="remember">Remember me</Label>
                  </div>
                  <a
                    href="/forgot-password"
                    className="text-sm text-brand-600 hover:underline dark:text-brand-500"
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Quick Demo Access (Development Only) */}
                {process.env.NODE_ENV === "development" && (
                  <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <p className="mb-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Quick Demo Access
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Admin Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickLogin(
                            "ljutzkanov@sporterp.co.uk",
                            "TestUser123"
                          )
                        }
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-purple-300 bg-white p-3 transition-all hover:border-purple-500 hover:bg-purple-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:hover:bg-purple-900/30"
                      >
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-xl dark:bg-purple-900/50">
                          👑
                        </div>
                        <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                          Admin
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Full Access
                        </span>
                      </button>

                      {/* Team Manager Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickLogin(
                            "teammanager@archon.dev",
                            "TestUser123"
                          )
                        }
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-blue-300 bg-white p-3 transition-all hover:border-blue-500 hover:bg-blue-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:hover:bg-blue-900/30"
                      >
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xl dark:bg-blue-900/50">
                          👥
                        </div>
                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                          Manager
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Team Lead
                        </span>
                      </button>

                      {/* Developer Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickLogin("developer@archon.dev", "TestUser123")
                        }
                        disabled={isLoading}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-green-300 bg-white p-3 transition-all hover:border-green-500 hover:bg-green-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:hover:bg-green-900/30"
                      >
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl dark:bg-green-900/50">
                          💻
                        </div>
                        <span className="text-xs font-semibold text-green-900 dark:text-green-300">
                          Developer
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Dev Tools
                        </span>
                      </button>
                    </div>
                    <p className="mt-2 text-center text-[10px] text-gray-500 dark:text-gray-400">
                      Click any role to instantly login
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  color="blue"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && (
                    <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Tabs.Item>

            {/* Magic Link Tab */}
            <Tabs.Item title="Magic Link">
              {!magicLinkSent ? (
                <form onSubmit={handleMagicLinkSend} className="space-y-4">
                  <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    Enter your email and we'll send you a magic link to sign in
                    instantly - no password needed!
                  </div>

                  {/* Email Field */}
                  <div>
                    <div className="mb-2 block">
                      <Label htmlFor="magic-email" value="Email address" />
                    </div>
                    <TextInput
                      id="magic-email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      color={magicLinkError ? "failure" : undefined}
                    />
                  </div>

                  {/* Error Message */}
                  {magicLinkError && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      {magicLinkError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    color="blue"
                    className="w-full"
                    disabled={magicLinkLoading}
                  >
                    {magicLinkLoading && (
                      <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {magicLinkLoading ? "Sending..." : "Send Magic Link"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  {/* Success State */}
                  <div className="flex justify-center">
                    <div className="rounded-full bg-green-100 p-4 text-4xl dark:bg-green-900/20">
                      ✉️
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                      Check your email!
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      We've sent a magic link to{" "}
                      <strong>{magicLinkEmail}</strong>. Click the link in your
                      email to sign in.
                    </p>
                  </div>
                  <Button
                    color="light"
                    className="w-full"
                    onClick={() => {
                      setMagicLinkSent(false);
                      setMagicLinkEmail("");
                    }}
                  >
                    Send another link
                  </Button>
                </div>
              )}
            </Tabs.Item>
          </Tabs>
        </Card>

        {/* Sign Up Link */}
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <a
            href="/sign-up"
            className="font-medium text-brand-600 hover:underline dark:text-brand-500"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
