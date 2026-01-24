/**
 * Spinner - Loading spinner component
 *
 * Provides animated spinner for loading states
 * Use for inline loading states or fullscreen overlays
 */

interface SpinnerProps {
  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "xl";

  /**
   * Color variant
   * @default "primary"
   */
  variant?: "primary" | "secondary" | "white";

  /**
   * Center in container
   * @default false
   */
  center?: boolean;

  /**
   * Label for screen readers
   * @default "Loading..."
   */
  label?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function Spinner({
  size = "md",
  variant = "primary",
  center = false,
  label = "Loading...",
  className = "",
}: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-4",
  };

  const variantClasses = {
    primary: "border-brand-600 border-t-transparent",
    secondary: "border-gray-600 border-t-transparent",
    white: "border-white border-t-transparent",
  };

  const spinner = (
    <div
      role="status"
      aria-label={label}
      className={`animate-spin rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );

  if (center) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * FullPageSpinner - Fullscreen loading spinner
 *
 * Covers entire viewport with loading overlay
 */

interface FullPageSpinnerProps {
  /**
   * Message to display below spinner
   */
  message?: string;

  /**
   * Semi-transparent backdrop
   * @default true
   */
  backdrop?: boolean;
}

export function FullPageSpinner({
  message = "Loading...",
  backdrop = true,
}: FullPageSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${
        backdrop ? "bg-white/80 dark:bg-gray-900/80" : ""
      }`}
    >
      <Spinner size="xl" variant="primary" />
      {message && (
        <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * InlineSpinner - Inline loading spinner with text
 *
 * Useful for button loading states or inline operations
 */

interface InlineSpinnerProps {
  /**
   * Text to display next to spinner
   */
  text?: string;

  /**
   * Size variant
   * @default "sm"
   */
  size?: "sm" | "md";
}

export function InlineSpinner({ text, size = "sm" }: InlineSpinnerProps) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size={size} variant="primary" />
      {text && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
      )}
    </div>
  );
}
