import React from "react";
import { ButtonVariant, EmptyStateConfig } from "@/lib/types";
import ButtonComponent from "../ButtonComponent";
import Link from "next/link";

interface EmptyStateProps {
  config: EmptyStateConfig;
  searchTerm?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ config, searchTerm }) => {
  const { type, title, description, icon, button, customContent } = config;

  // Default icons for different types
  const getDefaultIcon = () => {
    if (icon) return icon;

    if (type === "no_search_results") {
      return (
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    }

    if (type === "knowledge_base") {
      return (
        <svg
          className="w-24 h-24 text-gray-400 dark:text-gray-600 mx-auto mb-6"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Book */}
          <path
            d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Magnifying Glass */}
          <circle
            cx="15"
            cy="10"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-500 dark:text-brand-400"
          />
          <path
            d="M17.5 12.5L20 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-500 dark:text-brand-400"
          />
        </svg>
      );
    }

    // Default no_data icon
    return (
      <svg
        className="w-16 h-16 text-gray-400 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  const getDisplayTitle = () => {
    if (type === "no_search_results" && searchTerm) {
      return title.replace("{searchTerm}", `"${searchTerm}"`);
    }
    return title;
  };

  const getDisplayDescription = () => {
    if (type === "no_search_results" && searchTerm) {
      return description.replace("{searchTerm}", `"${searchTerm}"`);
    }
    return description;
  };

  if (customContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {customContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {getDefaultIcon()}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {getDisplayTitle()}
      </h3>

      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
        {getDisplayDescription()}
      </p>

      {button && (
        <div className="w-max">
          {button.href ? (
            <Link href={button.href}>
              <ButtonComponent
                name={button.text}
                variant={button.variant || ButtonVariant.PRIMARY}
                icon={button.icon}
                className={`w-max ${button.className || ""}`}
                fullWidth={false}
              />
            </Link>
          ) : (
            <ButtonComponent
              name={button.text}
              variant={button.variant || ButtonVariant.PRIMARY}
              icon={button.icon}
              onClick={button.onClick || (() => {})}
              className={`w-max ${button.className || ""}`}
              fullWidth={false}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
