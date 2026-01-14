"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback: React.ReactNode;
}

/**
 * Image component with fallback support
 * Similar to SportERP's ImageWithFallback pattern
 */
export function ImageWithFallback({
  src,
  alt,
  width,
  height,
  className = "",
  fallback,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // If no src or error occurred, show fallback
  if (!src || error) {
    return <>{fallback}</>;
  }

  return (
    <>
      {loading && fallback}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${loading ? "hidden" : ""}`}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        onLoad={() => setLoading(false)}
        priority={false}
      />
    </>
  );
}

export default ImageWithFallback;
