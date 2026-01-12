import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for feature flags/credentials
 * Returns environment-based configuration values
 */

const CREDENTIALS: Record<string, boolean | string> = {
  DARK_MODE_ENABLED: true,
  STYLE_GUIDE_ENABLED: true,
  // Add more feature flags here as needed
};

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const { key } = params;

  // Check if credential exists
  if (key in CREDENTIALS) {
    return NextResponse.json({
      success: true,
      key,
      value: CREDENTIALS[key],
    });
  }

  // Return 404 for unknown credentials
  return NextResponse.json(
    {
      success: false,
      error: `Credential '${key}' not found`,
    },
    { status: 404 }
  );
}
