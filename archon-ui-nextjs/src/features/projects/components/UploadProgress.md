# UploadProgress Component

Real-time progress monitoring component for document upload and website crawl operations.

## Features

- ✅ Real-time progress polling (1 second interval)
- ✅ Visual progress bar (0-100%)
- ✅ Current stage labels (e.g., "Extracting text", "Processing document")
- ✅ Status-based UI states (initializing, processing, completed, error, cancelled)
- ✅ Cancel operation support with confirmation dialog
- ✅ Auto-cleanup on unmount
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Smooth animations with Framer Motion
- ✅ Never-go-backwards progress logic (progress only increases)
- ✅ Terminal state handling (completed, error, cancelled)

## Usage

### Basic Example

```tsx
import { UploadProgress } from "@/features/projects/components";

function MyComponent() {
  const [progressId, setProgressId] = useState<string | null>(null);

  return (
    <>
      {progressId && (
        <UploadProgress
          progressId={progressId}
          operationType="upload"
          onComplete={() => {
            setProgressId(null);
            // Refresh document list
          }}
          onError={(error) => {
            console.error(error);
            setProgressId(null);
          }}
          onCancel={() => {
            setProgressId(null);
          }}
        />
      )}
    </>
  );
}
```

### Integrated with EnhancedDocumentUpload

```tsx
import { EnhancedDocumentUpload } from "@/features/projects/components";

function ProjectDocuments({ projectId }: { projectId: string }) {
  return (
    <EnhancedDocumentUpload
      projectId={projectId}
      onSuccess={() => {
        // Document list will auto-refresh after progress completes
        console.log("Upload successful");
      }}
      onError={(error) => {
        console.error("Upload failed:", error);
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `progressId` | `string` | Yes | Progress tracking ID from backend API |
| `operationType` | `"upload" \| "crawl"` | Yes | Type of operation being tracked |
| `onComplete` | `() => void` | No | Callback fired when operation completes successfully |
| `onError` | `(error: string) => void` | No | Callback fired when operation encounters an error |
| `onCancel` | `() => void` | No | Callback fired when operation is cancelled by user |

## API Integration

### Progress API Structure

The component polls `/api/progress/{progressId}` every 1 second and expects this response format:

```typescript
interface ProgressResponse {
  operation: {
    id: string;
    operation_type: "upload" | "crawl";
    status: "pending" | "crawling" | "processing" | "storing" | "completed" | "error" | "failed" | "cancelled";
    progress_percentage: number; // 0-100
    message: string | null;
    url?: string;
    current_url?: string;
    filename?: string;
    current_step?: string;
    pages_crawled?: number;
    total_pages?: number;
    code_examples_found?: number;
    error_message?: string | null;
    started_at: string;
    completed_at?: string | null;
  };
}
```

### Cancel Operation

When user clicks the "Cancel" button, the component sends:

```
DELETE /api/progress/{progressId}/cancel
```

## Status States

| Status | Color | Description |
|--------|-------|-------------|
| `pending` | Gray | Operation is initializing |
| `crawling` | Cyan | Crawling web pages (crawl only) |
| `processing` | Purple (upload) / Cyan (crawl) | Processing content |
| `storing` | Purple (upload) / Cyan (crawl) | Storing data to database |
| `completed` | Green | Operation completed successfully |
| `error` / `failed` | Red | Operation failed with error |
| `cancelled` | Red | Operation was cancelled by user |

## UI Elements

### Upload Operation
- **Progress Bar**: Purple theme
- **Status Badge**: Shows current status
- **Operation Type Badge**: "Document Upload"
- **Cancel Button**: Red, visible during processing
- **Success Icon**: Green checkmark on completion
- **Error Icon**: Red X on failure

### Crawl Operation
- **Progress Bar**: Cyan theme
- **Status Badge**: Shows current status
- **Operation Type Badge**: "Web Crawl"
- **Cancel Button**: Red, visible during processing
- **Stats Grid**: Pages crawled, total pages, code examples found
- **URL Display**: Clickable link to crawled URL
- **Success Icon**: Green checkmark on completion
- **Error Icon**: Red X on failure

## Styling

The component uses:
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Icons** for icons (HiCheckCircle, HiXCircle, HiStop, HiRefresh)

Color themes:
- Upload: Purple (`purple-500`, `purple-600`, `purple-700`)
- Crawl: Cyan (`cyan-500`, `cyan-600`, `cyan-700`)
- Success: Green (`green-500`, `green-600`, `green-700`)
- Error: Red (`red-500`, `red-600`, `red-700`)

## Accessibility

- ✅ Semantic HTML structure
- ✅ ARIA labels on buttons
- ✅ Color-blind friendly (uses icons + text)
- ✅ Keyboard navigation support
- ✅ Screen reader friendly

## Performance

- **Polling Interval**: 1 second (not configurable)
- **Auto-Stop**: Polling stops on terminal states (completed, error, cancelled)
- **Cleanup**: Interval cleared on unmount
- **Memory**: Previous progress values tracked to prevent backwards movement

## Error Handling

### Network Errors
- Continues polling if API request fails
- Logs error to console
- Does not stop polling (allows recovery)

### Operation Errors
- Displays error message from backend
- Shows red error badge
- Calls `onError` callback
- Stops polling

### Cancellation Errors
- Shows alert if cancel fails
- Allows retry
- Does not stop polling

## Examples

### Upload Document with Progress

```tsx
async function handleUpload(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (data.progressId) {
    setProgressId(data.progressId);
  }
}
```

### Crawl Website with Progress

```tsx
async function handleCrawl(url: string) {
  const response = await fetch(`/api/projects/${projectId}/documents/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, max_depth: 2 }),
  });

  const data = await response.json();

  if (data.progressId) {
    setProgressId(data.progressId);
  }
}
```

## Testing

See `__tests__/UploadProgress.test.tsx` for unit tests covering:
- Loading state
- Progress rendering
- Completion callback
- Error handling
- Cancellation
- Crawl statistics

## Related Components

- **EnhancedDocumentUpload**: Main upload form component
- **CrawlingProgress**: Knowledge base crawling progress (original reference implementation)
- **ProjectDocumentsTab**: Documents list with upload integration

## Changelog

### Version 1.0.0 (2026-01-23)
- Initial implementation
- Support for upload and crawl operations
- Real-time polling
- Cancel support
- Terminal state handling
- Dark mode support
