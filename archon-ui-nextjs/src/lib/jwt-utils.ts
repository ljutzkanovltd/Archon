/**
 * JWT Utility Functions
 *
 * Provides JWT decoding, expiry checking, and validation
 */

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  full_name?: string;
  role?: string;
  exp: number; // Expiration timestamp (seconds since epoch)
  iat?: number; // Issued at timestamp
  [key: string]: any; // Allow other claims
}

/**
 * Decode JWT token without verification
 * Note: This only decodes the payload, it does NOT verify the signature
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error("Invalid JWT format");
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Base64URL decode
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param token - JWT token string
 * @returns true if expired, false if still valid, null if invalid token
 */
export function isTokenExpired(token: string): boolean | null {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null; // Invalid token
  }

  // exp is in seconds, Date.now() is in milliseconds
  const now = Date.now() / 1000;
  return payload.exp < now;
}

/**
 * Get time until token expiration in milliseconds
 * @param token - JWT token string
 * @returns milliseconds until expiration, or null if invalid/expired
 */
export function getTimeUntilExpiry(token: string): number | null {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }

  const now = Date.now() / 1000;
  const timeLeft = payload.exp - now;

  if (timeLeft <= 0) {
    return null; // Already expired
  }

  return timeLeft * 1000; // Convert to milliseconds
}

/**
 * Check if token is about to expire (within threshold)
 * @param token - JWT token string
 * @param thresholdMinutes - Minutes before expiry to consider "expiring soon"
 * @returns true if token will expire within threshold
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdMinutes: number = 5
): boolean {
  const timeLeft = getTimeUntilExpiry(token);
  if (timeLeft === null) {
    return true; // Treat invalid/expired as "expiring soon"
  }

  const thresholdMs = thresholdMinutes * 60 * 1000;
  return timeLeft < thresholdMs;
}
