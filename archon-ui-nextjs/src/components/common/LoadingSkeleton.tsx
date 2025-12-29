interface LoadingSkeletonProps {
  className?: string;
  label?: string;
}

export function LoadingSkeleton({
  className = "",
  label = "Loading content",
}: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className}`}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
