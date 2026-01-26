/**
 * Type definitions for Archon dashboard
 */

export interface Menu {
  menu_code: string;
  menu_name: string;
  menu_url: string;
  menu_icon: string;
  sub_menu?: Menu[];
}

export interface Section {
  section_name: string;
  technical_code: string;
  menus: Menu[];
}

export enum ResourceType {
  PROFILE_AVATAR = "PROFILE_AVATAR",
  PROJECT_IMAGE = "PROJECT_IMAGE",
  DOCUMENT_IMAGE = "DOCUMENT_IMAGE",
}

export enum ButtonVariant {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  GHOST = "ghost",
  DANGER = "danger",
}

export enum ButtonType {
  SUBMIT = "submit",
  RESET = "reset",
  BUTTON = "button",
}

// Icon names from react-icons (extended from SportERP)
export type IconName =
  | "PLUS"
  | "CLOSE"
  | "CHECK"
  | "ARROW_UP"
  | "ARROW_DOWN"
  | "ARROW_LEFT"
  | "ARROW_RIGHT"
  | "FILTER"
  | "SEARCH"
  | "MENU"
  | "GRID"
  | "EYE"
  | "EYEOFF"
  | "EDIT"
  | "TRASH"
  | "MDEDITSQUARE"
  | "FAREGTRASHALT"
  | "SPINNER"
  | "REFRESH"
  | "DOWNLOAD"
  | "UPLOAD"
  | "COPY"
  | "LOCK"
  | "SETTINGS"
  | "CHART"
  | "DASHBOARD"
  | "DOCUMENTS"
  | "USERS"
  | "PROJECTS"
  | "COURSES"
  | "SHOP_PRODUCT"
  | "CALENDER"
  | "NOTIFICATIONS"
  | "GROUPS"
  | "SUBSCRIPTIONS"
  | "MESSAGES"
  | "NEWS_FEED"
  | "BOOKMARKS"
  | "ANALYSIS"
  | "TUTORIALS"
  | "HELP"
  | "SORT"
  | "SORT_UP"
  | "SORT_DOWN"
  | "PLAY"
  | "PAUSE"
  | "QUESTION";

// Button Props Interface (from SportERP)
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name?: string;
  icon?: IconName;
  color?: string;
  variant?: ButtonVariant;
  type?: ButtonType;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  checkbox?: boolean;
  iconLeft?: boolean;
  onCheckboxChange?: () => void;
  checked?: boolean;
  iconClassName?: string;
  fullWidth?: boolean;
}

// Modal Props Interface (from SportERP)
export interface CustomModalProps {
  open: boolean;
  close: () => void;
  title: string;
  description?: string;
  size?: "NORMAL" | "LARGE" | "FULL" | "MEDIUM";
  headerClassName?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

// Empty State Configuration (from SportERP)
export interface EmptyStateConfig {
  type: "no_data" | "no_search_results" | "knowledge_base";
  title: string;
  description: string;
  icon?: React.ReactNode;
  button?: {
    text: string;
    onClick?: () => void;
    href?: string;
    variant?: ButtonVariant;
    icon?: IconName;
    className?: string;
  };
  customContent?: React.ReactNode;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  github_repo?: string;
  workflow_id?: string;
  project_type_id?: string;
  project_type?: ProjectType;
  created_at: string;
  updated_at: string;
  task_count?: number;
  document_count?: number;
  linked_knowledge_count?: number;
  pinned?: boolean;
  archived?: boolean;
  // Phase 3: Hierarchy metadata
  parent_id?: string;
  children_count?: number;
  has_parent?: boolean;
  relationship_type?: string;
}

export interface ProjectType {
  id: string;
  name: string;
  description?: string;
  default_workflow_id?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  project_type_id?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  stage_order: number;
  workflow_id: string;
  color?: string;
  description?: string;
  default_agent?: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  // New workflow system fields
  workflow_stage_id: string;
  workflow_stage?: WorkflowStage;
  // Legacy field (mapped from workflow_stage.name for backward compatibility)
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string;
  feature?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  due_date?: string;
  archived?: boolean;
  archived_by?: string;
  archived_at?: string;
  // Sprint assignment
  sprint_id?: string;
  // Optional fields for knowledge linking
  sources?: string[];
  code_examples?: string[];
}

export interface Document {
  id: string;
  project_id: string;
  title: string;
  document_type: "spec" | "design" | "note" | "prp" | "api" | "guide";
  content: any;
  tags: string[];
  author: string;
  created_at: string;
  updated_at: string;
  version?: number;
}

// ==================== SPRINT TYPES ====================

export type SprintStatus = "planned" | "active" | "completed" | "cancelled";

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  velocity?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface SprintWithStats extends Sprint {
  task_count: number;
  completed_count: number;
  in_progress_count: number;
  planned_count: number;
}

// ==================== TEAM TYPES ====================

export type TeamRole = "member" | "lead" | "observer";

export interface Team {
  id: string;
  name: string;
  description?: string;
  project_id?: string;  // null for organization-wide teams
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

// ==================== KNOWLEDGE BASE TYPES ====================

export interface KnowledgeSource {
  source_id: string;
  title: string;
  summary?: string;
  url?: string;
  knowledge_type: "technical" | "business";
  level?: "basic" | "intermediate" | "advanced";
  tags: string[];
  metadata?: {
    tags?: string[];
    source_type?: string;
    original_url?: string;
    auto_generated?: boolean;
    knowledge_type?: string;
    update_frequency?: number;
  };
  documents_count?: number;
  code_examples_count?: number;
  total_words?: number;
  update_frequency?: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgePage {
  page_id: string;
  url: string;
  title: string;
  content?: string;
  full_content?: string;
  preview?: string;
  section_title?: string;
  word_count?: number;
  chunk_matches?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CodeExample {
  id: string;
  content: string;
  language?: string;
  description?: string;
  summary?: string;
  source_id: string;
  metadata?: Record<string, any>;
  similarity?: number;
  created_at?: string;
}

export interface KnowledgeSearchResult {
  success: boolean;
  results: KnowledgePage[] | ChunkResult[];
  return_mode: "pages" | "chunks";
  reranked?: boolean;
  error?: string | null;
}

export interface ChunkResult {
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

export interface CrawlStatus {
  operation_id: string;
  status: "pending" | "crawling" | "processing" | "storing" | "document_storage" | "completed" | "error" | "failed";
  progress?: number;
  message?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

// ==================== KNOWLEDGE CRAWL & UPLOAD TYPES ====================

export interface CrawlRequest {
  url: string;
  knowledge_type?: "technical" | "business";
  tags?: string[];
  max_depth?: number;  // 1-5, default: 2
  extract_code_examples?: boolean;  // default: true
}

export interface UploadMetadata {
  knowledge_type?: "technical" | "business";
  tags?: string[];
  extract_code_examples?: boolean;
}

export interface SourceUpdateRequest {
  title?: string;
  url?: string;
  knowledge_type?: "technical" | "business";
  level?: "basic" | "intermediate" | "advanced";
  summary?: string;
  tags?: string[];
}

export interface ProgressResponse {
  success: boolean;
  progressId: string;
  message: string;
  estimatedDuration?: string;
  filename?: string;
}

// ==================== PROGRESS TRACKING TYPES ====================

export type ProgressStatus =
  | "pending"
  | "crawling"
  | "processing"
  | "storing"
  | "document_storage"
  | "paused"
  | "completed"
  | "error"
  | "failed"
  | "cancelled";

export type ProgressOperationType = "crawl" | "upload" | "processing";

// Backend API response format
export interface ProgressApiResponse {
  operation_id: string;
  operation_type: "crawl" | "upload" | "processing";
  status: ProgressStatus;
  progress: number; // 0-100
  message: string | null;
  url?: string;
  current_url?: string;
  crawl_type?: string;
  pages_crawled?: number;
  total_pages?: number;
  code_examples_found?: number;
  started_at: string;
  completed_at?: string | null;
  error_message?: string | null;
}

// Frontend format (normalized)
export interface Progress {
  id: string;
  operation_type: ProgressOperationType;
  status: ProgressStatus;
  progress_percentage: number; // 0-100
  message: string | null;
  url?: string;
  current_url?: string;
  crawl_type?: string;
  filename?: string;
  current_step?: string;
  total_steps?: number;
  completed_steps?: number;
  pages_crawled?: number;
  total_pages?: number;
  code_examples_found?: number;
  current_depth?: number;
  max_depth?: number;
  error_message?: string | null;
  started_at: string;
  updated_at?: string;
  completed_at?: string | null;
  estimated_completion?: string | null;
  metadata?: Record<string, any>;
}

export interface ProgressListResponse {
  success: boolean;
  operations: Progress[];
  active_count: number;
  total_count: number;
}

export interface ProgressDetailResponse {
  success: boolean;
  operation: Progress;
}

export interface StopOperationResponse {
  success: boolean;
  message: string;
}

// ==================== SETTINGS TYPES ====================

export interface AppSettings {
  general: GeneralSettings;
  api_keys: ApiKeySettings;
  crawl: CrawlSettings;
  display: DisplaySettings;
  mcp: McpSettings;
  notifications: NotificationSettings;
}

export interface GeneralSettings {
  site_name: string;
  site_url: string;
  admin_email: string;
  timezone: string;
  language: string;
}

export interface ApiKeySettings {
  openai_api_key?: string;
  azure_openai_endpoint?: string;
  azure_openai_key?: string;
  azure_openai_api_version?: string;
  azure_openai_deployment?: string;
  supabase_url?: string;
  supabase_service_key?: string;
}

export interface CrawlSettings {
  default_max_depth: number;  // 1-5
  default_crawl_type: "technical" | "business";
  extract_code_examples: boolean;
  respect_robots_txt: boolean;
  rate_limit_delay_ms: number;  // Milliseconds between requests
  max_concurrent_crawls: number;
  user_agent: string;
}

export interface DisplaySettings {
  default_theme: "light" | "dark" | "system";
  default_view_mode: "grid" | "table";
  items_per_page: number;
  show_sidebar_by_default: boolean;
  sidebar_collapsed_by_default: boolean;
  enable_animations: boolean;
}

export interface McpSettings {
  mcp_server_url: string;  // default: http://localhost:8051
  mcp_enabled: boolean;
  mcp_timeout_ms: number;
  enable_mcp_inspector: boolean;  // Debug mode
  log_mcp_requests: boolean;
}

export interface NotificationSettings {
  enable_notifications: boolean;
  crawl_complete_notification: boolean;
  error_notifications: boolean;
  notification_sound: boolean;
}

export interface SettingsUpdateRequest {
  section: keyof AppSettings;
  data: Partial<AppSettings[keyof AppSettings]>;
}

// API Response type for settings
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ==================== MCP SERVER TYPES ====================

export interface McpServerStatus {
  status: "running" | "starting" | "stopped" | "stopping";
  uptime: number | null;
  logs: string[];
}

export interface McpServerConfig {
  transport: string;
  host: string;
  port: number;
  model?: string;
}

export interface McpClient {
  session_id: string;
  client_type: "Claude" | "Cursor" | "Windsurf" | "Cline" | "KiRo" | "Augment" | "Gemini" | "Unknown";
  client_version?: string;
  connected_at: string;
  last_activity: string;
  status: "active" | "idle" | "disconnected";
  disconnected_at?: string;
  total_duration?: number;
  disconnect_reason?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

export interface McpSessionInfo {
  active_sessions: number;
  session_timeout: number;
  server_uptime_seconds?: number;
  clients?: McpClient[];
}

export type SupportedIDE = "claudecode" | "gemini" | "codex" | "cursor" | "windsurf" | "cline" | "kiro";

// ==================== MCP REQUEST & ERROR TYPES ====================

/**
 * Request status enum - shared across all request-related types
 */
export type McpRequestStatus = "success" | "error" | "timeout";

/**
 * Individual MCP request (tool call) with token usage and performance
 * Maps to: archon_mcp_requests table
 */
export interface McpRequest {
  request_id: string;
  session_id: string;
  method: string;
  tool_name: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  timestamp: string;
  duration_ms: number | null;
  status: McpRequestStatus;
  error_message: string | null;
}

/**
 * Request usage summary for a session
 */
export interface McpRequestSummary {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
}

/**
 * Extended session details with full request history
 * API Response: GET /api/mcp/sessions/{session_id}
 */
export interface McpSessionDetails {
  session: McpSessionMetadata;
  requests: McpRequest[];
  summary: McpRequestSummary;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

/**
 * Detailed session metadata (extends McpClient)
 * Maps to: archon_mcp_sessions table
 */
export interface McpSessionMetadata {
  session_id: string;
  client_type: string;
  client_version: string | null;
  client_capabilities: Record<string, any> | null;
  connected_at: string;
  disconnected_at: string | null;
  last_activity: string;
  status: "active" | "idle" | "disconnected";
  metadata: Record<string, any>;
}

/**
 * Error severity levels
 */
export type McpErrorSeverity = "error" | "warning" | "timeout";

/**
 * Individual error/warning entry
 * Used by: ErrorWarningMonitor component
 */
export interface McpError {
  request_id: string;
  session_id: string;
  tool_name: string | null;
  error_message: string;
  timestamp: string;
  severity: McpErrorSeverity;
  duration_ms: number | null;
  method: string;
  session_client_type?: string;
}

/**
 * Error summary statistics
 * API Response: GET /api/mcp/errors
 */
export interface McpErrorSummary {
  error_count: number;
  timeout_count: number;
  last_error_at: string | null;
  error_rate_percent: number;
}

/**
 * Error monitoring response
 * API Response: GET /api/mcp/errors?severity=error&limit=50
 */
export interface McpErrorResponse {
  errors: McpError[];
  summary: McpErrorSummary;
  total: number;
}

// ==================== MCP ANALYTICS TYPES ====================

/**
 * Daily trend data point for analytics
 */
export interface McpDailyTrend {
  date: string;  // YYYY-MM-DD format
  requests: number;
  tokens: number;
  cost: number;
  success_rate: number;  // Percentage (0-100)
}

/**
 * Hourly usage pattern (peak times)
 */
export interface McpHourlyTrend {
  hour: number;  // 0-23
  requests: number;
  avg_duration: number;  // Average duration in milliseconds
}

/**
 * Success/failure ratio statistics
 */
export interface McpRatios {
  success: number;
  error: number;
  timeout: number;
  success_rate: number;  // Percentage (0-100)
}

/**
 * Response time statistics by tool
 */
export interface McpToolResponseTime {
  tool: string;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  count: number;
}

/**
 * Overall response time statistics with percentiles
 */
export interface McpResponseTimes {
  by_tool: McpToolResponseTime[];
  overall_avg: number;  // Average across all requests (ms)
  p50: number;  // Median (ms)
  p95: number;  // 95th percentile (ms)
  p99: number;  // 99th percentile (ms)
}

/**
 * Comparison metric structure
 */
export interface McpComparisonMetric {
  current: number;
  previous: number;
  change_percent: number;  // Positive = increase, negative = decrease
}

/**
 * Period comparison data
 */
export interface McpComparison {
  requests: McpComparisonMetric;
  success_rate: McpComparisonMetric;
  tokens: McpComparisonMetric;
  cost: McpComparisonMetric;
}

/**
 * Complete analytics response
 * API Response: GET /api/mcp/analytics?days=30&compare=true
 */
export interface McpAnalyticsResponse {
  period: {
    days: number;
    start: string;  // ISO timestamp
    end: string;    // ISO timestamp
  };
  trends: {
    daily: McpDailyTrend[];
    hourly: McpHourlyTrend[];
  };
  ratios: McpRatios;
  response_times: McpResponseTimes;
  comparison: McpComparison | null;  // Null if compare=false
}

// ==================== MCP LOGS TYPES ====================

/**
 * Log level enum (mapped from request status)
 */
export type McpLogLevel = "info" | "warning" | "error" | "debug" | "all";

/**
 * MCP log entry (extended from McpRequest with level field)
 */
export interface McpLogEntry extends McpRequest {
  level: McpLogLevel;  // Computed from status: success=info, timeout=warning, error=error
}

/**
 * Logs response with pagination
 * API Response: GET /api/mcp/logs?level=error&search=timeout&limit=100&offset=0
 */
export interface McpLogsResponse {
  logs: McpLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}
