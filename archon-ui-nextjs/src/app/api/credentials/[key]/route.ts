import { NextRequest, NextResponse } from "next/server";

/**
 * Feature flag API endpoint
 * Returns configuration values for feature toggles
 */

// Default feature flags configuration
const FEATURE_FLAGS: Record<string, boolean | string> = {
  PROJECTS_ENABLED: true,
  TASKS_ENABLED: true,
  KNOWLEDGE_BASE_ENABLED: true,
  MCP_SERVER_DASHBOARD_ENABLED: true,
  AGENT_WORK_ORDERS_ENABLED: true,
  LOGFIRE_ENABLED: false,
  DISCONNECT_SCREEN_ENABLED: false,
  DARK_MODE_ENABLED: true,
  STYLE_GUIDE_ENABLED: true,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  // Check if feature flag exists
  if (key in FEATURE_FLAGS) {
    return NextResponse.json({
      key,
      value: FEATURE_FLAGS[key],
      enabled: FEATURE_FLAGS[key] === true,
    });
  }

  // Return 404 for unknown keys
  return NextResponse.json(
    { error: "Feature flag not found", key },
    { status: 404 }
  );
}
