/**
 * JWT Validation Middleware for Next.js API Routes
 *
 * Provides authentication and user context extraction for CopilotKit integration
 */

import { NextRequest } from 'next/server';

// ===========================
// Type Definitions
// ===========================

export interface UserContext {
  userId: string;
  email: string;
  fullName?: string;
  role: 'owner' | 'member' | 'viewer' | 'admin';
  accessibleProjectIds: string[];
  currentProjectId?: string;
  organizationId?: string;
}

export interface JWTPayload {
  sub: string; // userId
  email: string;
  full_name?: string;
  role?: string;
  org_id?: string;
  exp: number;
  iat: number;
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor() {
    super('Token has expired', 401);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = 'Invalid token') {
    super(message, 401);
    this.name = 'InvalidTokenError';
  }
}

// ===========================
// JWT Utilities
// ===========================

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Check for Bearer scheme
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Decode JWT payload without verification (for development)
 *
 * WARNING: This does NOT verify the signature!
 * Use verifyJWT for production with proper secret verification.
 */
export function decodeJWTPayload(token: string): JWTPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidTokenError('Malformed token: expected 3 parts');
    }

    // Decode base64url payload
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as JWTPayload;

    // Validate required fields
    if (!parsed.sub || !parsed.email) {
      throw new InvalidTokenError('Token missing required fields (sub, email)');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp && parsed.exp < now) {
      throw new TokenExpiredError();
    }

    return parsed;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new InvalidTokenError('Failed to decode token');
  }
}

/**
 * Verify JWT signature and decode payload
 *
 * TODO: Implement proper signature verification with JWT library
 * For now, uses basic decoding. Add jsonwebtoken or jose library for production.
 *
 * @param token - JWT token
 * @param secret - JWT secret (from env)
 */
export async function verifyJWT(
  token: string,
  secret?: string
): Promise<JWTPayload> {
  // For POC, use decode without verification
  // Production: Use jsonwebtoken.verify() or jose library

  if (!token) {
    throw new InvalidTokenError('No token provided');
  }

  try {
    const payload = decodeJWTPayload(token);

    // TODO: Add signature verification
    // const verified = jwt.verify(token, secret || process.env.JWT_SECRET);

    return payload;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new InvalidTokenError('Token verification failed');
  }
}

// ===========================
// User Context Extraction
// ===========================

/**
 * Extract user context from JWT payload and fetch additional permissions
 *
 * Uses the user-context service to query backend API for:
 * - Project memberships
 * - Organization access
 * - Role-based permissions
 *
 * Implements caching to minimize API calls.
 */
export async function extractUserContext(
  payload: JWTPayload,
  token: string
): Promise<UserContext> {
  const { getUserContext } = await import('./services/user-context');

  // Get complete user context with project memberships from Backend API
  const fullContext = await getUserContext(
    payload.sub,
    payload.email,
    payload.full_name,
    (payload.role as UserContext['role']) || 'member',
    token
  );

  // Map to UserContext interface expected by CopilotKit
  const context: UserContext = {
    userId: fullContext.userId,
    email: fullContext.email,
    fullName: fullContext.fullName,
    role: fullContext.role,
    accessibleProjectIds: fullContext.accessibleProjectIds,
    organizationId: payload.org_id
  };

  return context;
}

// ===========================
// Middleware Function
// ===========================

/**
 * Validate JWT and extract user context
 *
 * Usage in API route:
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const userContext = await validateJWT(req);
 *   // ... use userContext for authorization
 * }
 * ```
 */
export async function validateJWT(
  request: NextRequest
): Promise<UserContext> {
  // Extract token
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthenticationError('Missing authorization token');
  }

  // Verify token
  const payload = await verifyJWT(token);

  // Extract user context (with API queries for permissions and project memberships)
  const userContext = await extractUserContext(payload, token);

  return userContext;
}

/**
 * Optional middleware wrapper for error handling
 *
 * Usage:
 * ```ts
 * export async function POST(req: NextRequest) {
 *   return withAuth(req, async (userContext) => {
 *     // Your authenticated handler logic
 *     return Response.json({ message: 'Success' });
 *   });
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: (userContext: UserContext) => Promise<Response>
): Promise<Response> {
  try {
    const userContext = await validateJWT(request);
    return await handler(userContext);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Unexpected authentication error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================
// Mock Token Generation (Development Only)
// ===========================

/**
 * Generate mock JWT for development/testing
 *
 * WARNING: Only use in development! Never use in production.
 */
export function generateMockJWT(params: {
  userId: string;
  email: string;
  fullName?: string;
  role?: string;
  expiresIn?: number; // seconds
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.expiresIn || 3600); // 1 hour default

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload: JWTPayload = {
    sub: params.userId,
    email: params.email,
    full_name: params.fullName,
    role: params.role,
    exp,
    iat: now
  };

  // Encode header and payload (no signature for mock)
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mockSignature = 'mock-signature'; // Not a real signature

  return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
}

// ===========================
// Exports
// ===========================

export {
  validateJWT as default,
  validateJWT,
  withAuth,
  extractBearerToken,
  verifyJWT,
  extractUserContext,
  generateMockJWT
};
