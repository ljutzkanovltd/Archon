/**
 * Skeleton - Base skeleton loader component
 *
 * Provides animated skeleton placeholders for loading states
 * Used as building block for more complex skeleton layouts
 */

interface SkeletonProps {
  /**
   * Width of skeleton (CSS value: px, %, rem, etc.)
   * @default "100%"
   */
  width?: string | number;

  /**
   * Height of skeleton (CSS value: px, %, rem, etc.)
   * @default "1rem"
   */
  height?: string | number;

  /**
   * Border radius variant
   * @default "md"
   */
  variant?: "none" | "sm" | "md" | "lg" | "full";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Aria label for accessibility
   * @default "Loading..."
   */
  ariaLabel?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  variant = "md",
  className = "",
  ariaLabel = "Loading...",
}: SkeletonProps) {
  const variantClasses = {
    none: "",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

/**
 * SkeletonText - Skeleton for text content
 * Automatically creates multiple lines with realistic widths
 */
interface SkeletonTextProps {
  /**
   * Number of lines to render
   * @default 3
   */
  lines?: number;

  /**
   * Line height
   * @default "1rem"
   */
  lineHeight?: string | number;

  /**
   * Gap between lines
   * @default "0.5rem"
   */
  gap?: string;

  /**
   * Randomize last line width (realistic paragraph effect)
   * @default true
   */
  randomizeLastLine?: boolean;
}

export function SkeletonText({
  lines = 3,
  lineHeight = "1rem",
  gap = "0.5rem",
  randomizeLastLine = true,
}: SkeletonTextProps) {
  // Use deterministic widths based on line index to avoid hydration mismatch
  // Previously used Math.random() which caused SSR/client mismatch
  const getLastLineWidth = (lineIndex: number) => {
    const widths = ["75%", "80%", "65%", "70%", "85%"];
    return widths[lineIndex % widths.length];
  };

  return (
    <div className="space-y-2" style={{ gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={
            randomizeLastLine && index === lines - 1
              ? getLastLineWidth(index)
              : "100%"
          }
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCircle - Circular skeleton (avatars, icons)
 */
interface SkeletonCircleProps {
  /**
   * Size of circle (diameter)
   * @default "2.5rem"
   */
  size?: string | number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function SkeletonCircle({ size = "2.5rem", className = "" }: SkeletonCircleProps) {
  const sizeValue = typeof size === "number" ? `${size}px` : size;

  return (
    <Skeleton
      width={sizeValue}
      height={sizeValue}
      variant="full"
      className={className}
    />
  );
}
