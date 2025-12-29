"use client";

interface TaskHeaderProps {
  title: string;
  description?: string;
}

/**
 * TaskHeader - Header component for tasks pages
 *
 * Displays page title, description, and action buttons.
 */
export function TaskHeader({ title, description }: TaskHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        {title}
      </h1>
      {description && (
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}
