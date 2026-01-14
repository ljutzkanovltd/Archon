"use client";

import { HiUser, HiLockClosed, HiMail } from "react-icons/hi";
import TabView, { TabItem } from "@/components/common/TabView";
import { ProfileOverviewForm } from "./components/ProfileOverviewForm";
import { ChangePasswordForm } from "./components/ChangePasswordForm";
import { ChangeEmailForm } from "./components/ChangeEmailForm";

export default function ProfileSettingsPage() {
  const profileTabs: TabItem[] = [
    {
      id: "overview",
      label: "Overview",
      icon: HiUser,
      component: <ProfileOverviewForm />,
      default: true,
    },
    {
      id: "email",
      label: "Email",
      icon: HiMail,
      component: <ChangeEmailForm />,
    },
    {
      id: "security",
      label: "Security",
      icon: HiLockClosed,
      component: <ChangePasswordForm />,
    },
  ];

  return (
    <div className="p-6 animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Profile Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your personal information and security settings
        </p>
      </div>

      <TabView tabsList={profileTabs} />
    </div>
  );
}
