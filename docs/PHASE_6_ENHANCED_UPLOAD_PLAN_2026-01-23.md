# Phase 6: Enhanced Upload (KB Integration) - Complete Plan

**Date:** 2026-01-23
**Project:** Project Document Management (f8311680-58a7-45e6-badf-de55d3d9cd24)
**Status:** Planning Complete - Ready for Implementation

---

## 🎯 Goals & Requirements

### User Requirements (Analyzed)

**Direct Quote:**
> "On the document tab I also need to be able to have a check box if it needs to be sent to knowledge base directly. I need to be able to drag and drop it not just provide document url itself and ideally would be a model exactly as it is done in the knowledge base. So I can use the same logic for the model of the knowledge base and follow the same protocol."

**Interpreted Requirements:**
1. ✅ **Drag-and-drop file upload** - Not just URLs, actual files
2. ✅ **Send to KB checkbox** - Option to add directly to global KB during upload
3. ✅ **Reuse KB model** - Same upload logic/protocol as knowledge base
4. ✅ **Support both resources** - URLs AND documents (both are resources)
5. ✅ **Project-scoped protection** - Keep documents private OR promote to global KB
6. ✅ **Unified experience** - Same interface as knowledge base upload

---

## 📊 Current State Analysis

### Knowledge Base Upload (Existing Reference)

**Frontend: `AddSourceDialog.tsx`**
- **Two tabs:**
  - "Crawl Website" - URL crawling with max_depth, progress tracking
  - "Upload Document" - Drag-and-drop file input (.txt, .md, .pdf, .doc, .docx, .html, .htm)
- **Metadata fields:**
  - `knowledge_type`: "technical" | "business"
  - `tags`: string[] (with add/remove UI)
  - `extract_code_examples`: boolean toggle
  - `max_depth`: number slider (1-5, crawl only)
- **File upload UI:**
  ```tsx
  <input type="file" className="opacity-0" onChange={...} />
  <div className="border-2 border-dashed">
    <HiUpload /> Click to browse or drag & drop
  </div>
  ```
- **Callbacks:**
  - `onCrawl(CrawlRequest)` - Handles URL crawling
  - `onUpload(File, UploadMetadata)` - Handles file uploads

**Backend: `/api/documents/upload`**
- **Parameters:**
  - `file: UploadFile` (FastAPI File upload)
  - `tags: str` (JSON-encoded array)
  - `knowledge_type: str` (default: "technical")
  - `extract_code_examples: bool` (default: true)
- **Process:**
  1. Validate API key (OpenAI/Ollama for embeddings)
  2. Read file content immediately
  3. Generate `progress_id` (UUID)
  4. Initialize ProgressTracker
  5. Start background task: `_perform_upload_with_progress`
  6. Extract text with `extract_text_from_document()`
  7. Use `DocumentStorageService.upload_document()` with progress callback
  8. Return: `{ success, progressId, message, filename }`

**Backend: URL Crawling**
- **Endpoint:** `/api/knowledge-items/crawl` (implicit from KnowledgeItemRequest)
- **Process:**
  1. Validate URL
  2. Check API key
  3. Use `CrawlingService` with max_depth, extract_code_examples
  4. Progress tracking via ProgressTracker
  5. Store in `archon_sources` and `archon_crawled_pages`

### Project Documents Upload (Current State)

**Frontend: `DocumentUploadDropzone.tsx`**
- ❌ **URL-only** - No file upload support
- ✅ **Privacy control** - `is_project_private` checkbox (default: true)
- ❌ **No KB integration** - Can't send to global KB during upload
- ❌ **No metadata** - No knowledge_type, tags, or extract_code_examples
- ❌ **No progress tracking** - Synchronous upload

**Backend: `/api/projects/{id}/documents` (POST)**
- **Parameters:**
  - `url: str` (required)
  - `title: str` (optional)
  - `is_project_private: bool` (default: true)
- **Process:**
  1. Validate project exists
  2. Insert into `archon_sources` with `project_id` and `is_project_private`
  3. Return: `{ document: {...} }`

**Gaps:**
- ❌ No file upload endpoint
- ❌ No URL crawling endpoint (with project scoping)
- ❌ No progress tracking
- ❌ No metadata fields (knowledge_type, tags, extract_code_examples)
- ❌ No KB integration checkbox

---

## 🏗️ Architecture Design

### Unified Upload Model

**Core Principle:** Reuse knowledge base upload logic with project scoping extension.

**Data Model:**
```typescript
interface ProjectDocumentUploadRequest {
  // Core fields (from KB)
  knowledge_type: "technical" | "business";
  tags: string[];
  extract_code_examples: boolean;

  // Project-specific fields
  project_id: string;
  is_project_private: boolean;
  send_to_kb: boolean;  // NEW: Option to add to global KB immediately

  // File upload (mutually exclusive with url)
  file?: File;

  // URL crawl (mutually exclusive with file)
  url?: string;
  max_depth?: number;  // Only for URL crawls
}
```

**Backend Database Storage:**
```sql
-- archon_sources table (existing schema)
INSERT INTO archon_sources (
  source_id,
  source_url,
  title,
  project_id,              -- Project scoping
  is_project_private,      -- Privacy control
  knowledge_type,          -- From KB model
  tags,                    -- From KB model
  extract_code_examples,   -- From KB model
  promoted_to_kb_at,       -- If send_to_kb = true
  promoted_by              -- If send_to_kb = true
) VALUES (...);
```

**Flow Diagram:**
```
User Action
    |
    ├─ Select "Upload Document" tab
    |   └─ Drag-and-drop file or click to browse
    |       ├─ Set metadata: knowledge_type, tags, extract_code_examples
    |       ├─ Set privacy: is_project_private (checkbox)
    |       └─ Set send_to_kb (checkbox - NEW)
    |           └─ POST /api/projects/{id}/documents/upload
    |               ├─ Returns: { progressId }
    |               └─ Poll: GET /api/progress/{progressId}
    |                   └─ On completion: refresh document list
    |
    └─ Select "Crawl URL" tab
        └─ Enter URL + metadata
            ├─ Set max_depth slider
            ├─ Set privacy: is_project_private (checkbox)
            └─ Set send_to_kb (checkbox - NEW)
                └─ POST /api/projects/{id}/documents/crawl
                    └─ Same progress flow as file upload
```

---

## 📝 Implementation Plan - 7 Tasks

### Phase 6.1: Research KB Upload API and Model
**Assignee:** codebase-analyst
**Estimated:** 1.0 hours
**Status:** Backlog

**Goals:**
- Analyze `AddSourceDialog.tsx` component structure
- Analyze `/api/documents/upload` endpoint implementation
- Analyze `DocumentStorageService.upload_document()` logic
- Document progress tracking patterns (ProgressTracker)
- Document file validation and text extraction
- Document metadata structure and usage

**Deliverables:**
- Complete KB upload architecture document
- Code patterns for reuse in project documents
- API contract documentation

---

### Phase 6.2: Create EnhancedDocumentUpload Component
**Assignee:** ui-implementation-expert
**Estimated:** 3.0 hours
**Status:** Backlog

**Goals:**
Create new React component `EnhancedDocumentUpload.tsx` based on `AddSourceDialog.tsx`:

**Features:**
1. **Two tabs:**
   - "Crawl URL" - URL input with max_depth slider
   - "Upload Document" - Drag-and-drop file input

2. **Common metadata fields:**
   - Knowledge Type: "technical" | "business" (select)
   - Tags: string[] (input with add/remove chips)
   - Extract Code Examples: boolean (toggle switch)

3. **Project-specific fields:**
   - Privacy: "Keep Private" checkbox (default: checked)
   - Send to KB: "Add to Global Knowledge Base" checkbox (default: unchecked)

4. **File upload UI:**
   ```tsx
   <div className="border-2 border-dashed rounded-xl">
     <input type="file" className="opacity-0 absolute" />
     <HiUpload /> Drag & drop or click to browse
     {selectedFile && (
       <p>{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</p>
     )}
   </div>
   ```

5. **Props interface:**
   ```typescript
   interface EnhancedDocumentUploadProps {
     projectId: string;
     onUploadSuccess?: (document: any) => void;
     onCrawlSuccess?: (document: any) => void;
     onError?: (error: string) => void;
     onClose?: () => void;
   }
   ```

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│  Add Project Document               [X] │
├─────────────────────────────────────────┤
│  [Crawl URL] [Upload Document]          │  ← Tabs
├─────────────────────────────────────────┤
│  ┌────────────────────────────────────┐ │
│  │ [Upload Icon]                      │ │
│  │ Drag & drop or click to browse     │ │
│  │ PDF, DOC, DOCX, TXT, MD supported  │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Knowledge Type: [Technical ▼]          │
│  Tags: [tag1] [tag2] [+ Add]            │
│  [✓] Extract Code Examples              │
│  [✓] Keep Private (Project-scoped)      │
│  [ ] Add to Global Knowledge Base       │
│                                          │
│  [Cancel]              [Upload Document]│
└─────────────────────────────────────────┘
```

**Deliverables:**
- `EnhancedDocumentUpload.tsx` component
- Full TypeScript type definitions
- Dark mode support
- Accessibility (ARIA labels)
- Form validation
- Loading states

---

### Phase 6.3: Create POST /api/projects/{id}/documents/upload
**Assignee:** backend-api-expert
**Estimated:** 2.5 hours
**Status:** Backlog

**Goals:**
Create backend endpoint for project-scoped file uploads in `projects_documents.py`:

**Endpoint:**
```python
@router.post("/projects/{project_id}/documents/upload")
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    tags: str | None = Form(None),
    knowledge_type: str = Form("technical"),
    extract_code_examples: bool = Form(True),
    is_project_private: bool = Form(True),
    send_to_kb: bool = Form(False),
    _user: dict = Depends(require_document_manage)
):
    """
    Upload and process a document for a specific project.

    - **project_id**: Project UUID
    - **file**: Document file (PDF, DOC, DOCX, TXT, MD, HTML)
    - **tags**: JSON array of tags
    - **knowledge_type**: "technical" or "business"
    - **extract_code_examples**: Whether to extract code snippets
    - **is_project_private**: Keep private (True) or promote to global KB (False)
    - **send_to_kb**: Send to KB immediately (sets promoted_to_kb_at)

    Returns: { success, progressId, message, filename }
    """
```

**Implementation:**
1. Validate project exists and user has permission
2. Parse tags from JSON
3. Read file content immediately
4. Generate `progress_id` (UUID)
5. Initialize ProgressTracker
6. Start background task: `_perform_project_upload_with_progress`
7. Reuse `DocumentStorageService.upload_document()` logic
8. Insert into `archon_sources` with:
   - `project_id` (project scoping)
   - `is_project_private` (privacy control)
   - `promoted_to_kb_at` = NOW if `send_to_kb = True`
   - `promoted_by` = current user if `send_to_kb = True`
9. Return: `{ success: true, progressId, message, filename }`

**Reuse Patterns:**
- Copy from `/api/documents/upload` in `knowledge_api.py`
- Adapt `_perform_upload_with_progress` for project scoping
- Use same progress tracking logic
- Use same file validation and text extraction

**Deliverables:**
- Backend endpoint implementation
- Progress tracking integration
- RBAC protection (require_document_manage)
- Error handling and validation
- API documentation (OpenAPI)

---

### Phase 6.4: Add URL Crawling for Project Documents
**Assignee:** backend-api-expert
**Estimated:** 2.0 hours
**Status:** Backlog

**Goals:**
Create backend endpoint for project-scoped URL crawling in `projects_documents.py`:

**Endpoint:**
```python
@router.post("/projects/{project_id}/documents/crawl")
async def crawl_project_url(
    project_id: str,
    request: ProjectCrawlRequest,
    _user: dict = Depends(require_document_manage)
):
    """
    Crawl a URL and add to project knowledge base.

    - **project_id**: Project UUID
    - **url**: Website URL to crawl
    - **knowledge_type**: "technical" or "business"
    - **tags**: List of tags
    - **max_depth**: Crawl depth (1-5)
    - **extract_code_examples**: Extract code snippets
    - **is_project_private**: Keep private or promote to global KB
    - **send_to_kb**: Send to KB immediately

    Returns: { success, progressId, message, url }
    """
```

**Request Model:**
```python
class ProjectCrawlRequest(BaseModel):
    url: str
    knowledge_type: str = "technical"
    tags: list[str] = []
    max_depth: int = 2
    extract_code_examples: bool = True
    is_project_private: bool = True
    send_to_kb: bool = False
```

**Implementation:**
1. Validate project exists and user has permission
2. Validate URL format
3. Generate `progress_id` (UUID)
4. Initialize ProgressTracker
5. Start background task: `_perform_project_crawl_with_progress`
6. Reuse `CrawlingService` logic with project scoping
7. Insert into `archon_sources` with project_id and privacy settings
8. Return: `{ success: true, progressId, message, url }`

**Reuse Patterns:**
- Copy from URL crawling logic in `knowledge_api.py`
- Adapt for project scoping (add `project_id` to all inserts)
- Use same progress tracking
- Use same crawl depth and concurrency limits

**Deliverables:**
- Backend endpoint implementation
- ProjectCrawlRequest Pydantic model
- Progress tracking integration
- RBAC protection
- API documentation

---

### Phase 6.5: Replace DocumentUploadDropzone with EnhancedDocumentUpload
**Assignee:** ui-implementation-expert
**Estimated:** 2.0 hours
**Status:** Backlog

**Goals:**
Integrate EnhancedDocumentUpload into ProjectDocumentsTab:

**Changes to `ProjectDocumentsTab.tsx`:**
1. **Remove:**
   - `DocumentUploadDropzone` import and usage
   - URL-only upload form

2. **Add:**
   - `EnhancedDocumentUpload` import
   - Upload/crawl callbacks
   - Progress monitoring state
   - Modal/dialog wrapper

3. **Upload callback:**
   ```typescript
   const handleDocumentUpload = async (file: File, metadata: UploadMetadata) => {
     const formData = new FormData();
     formData.append('file', file);
     formData.append('tags', JSON.stringify(metadata.tags));
     formData.append('knowledge_type', metadata.knowledge_type);
     formData.append('extract_code_examples', String(metadata.extract_code_examples));
     formData.append('is_project_private', String(metadata.is_project_private));
     formData.append('send_to_kb', String(metadata.send_to_kb));

     const response = await fetch(
       `http://localhost:8181/api/projects/${projectId}/documents/upload?project_id=${projectId}`,
       {
         method: 'POST',
         headers: { Authorization: `Bearer ${token}` },
         body: formData,
       }
     );

     const data = await response.json();
     if (data.success) {
       // Start progress monitoring
       startProgressMonitoring(data.progressId);
     }
   };
   ```

4. **Crawl callback:**
   ```typescript
   const handleUrlCrawl = async (crawlData: CrawlRequest) => {
     const response = await fetch(
       `http://localhost:8181/api/projects/${projectId}/documents/crawl?project_id=${projectId}`,
       {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`
         },
         body: JSON.stringify(crawlData),
       }
     );

     const data = await response.json();
     if (data.success) {
       startProgressMonitoring(data.progressId);
     }
   };
   ```

**Deliverables:**
- Updated ProjectDocumentsTab component
- Upload and crawl callback implementations
- Modal/dialog integration
- Error handling
- Success notifications

---

### Phase 6.6: Add Upload/Crawl Progress Monitoring
**Assignee:** ui-implementation-expert
**Estimated:** 2.5 hours
**Status:** Backlog

**Goals:**
Create progress monitoring UI for uploads and crawls:

**Component:** `DocumentProgressMonitor.tsx`

**Features:**
1. **Progress polling:**
   ```typescript
   const pollProgress = async (progressId: string) => {
     const interval = setInterval(async () => {
       const response = await fetch(`http://localhost:8181/api/progress/${progressId}`);
       const data = await response.json();

       setProgress(data.progress);
       setStatus(data.status);
       setLog(data.log);

       if (data.status === 'completed' || data.status === 'error') {
         clearInterval(interval);
         if (data.status === 'completed') {
           onComplete(data);
         } else {
           onError(data.error);
         }
       }
     }, 1000); // Poll every second
   };
   ```

2. **Progress bar:**
   ```tsx
   <div className="w-full bg-gray-200 rounded-full h-2">
     <div
       className="bg-brand-600 h-2 rounded-full transition-all"
       style={{ width: `${progress}%` }}
     />
   </div>
   <p>{progress}% - {status}</p>
   <p className="text-sm text-gray-500">{log}</p>
   ```

3. **Cancel button:**
   ```typescript
   const handleCancel = async () => {
     await fetch(`http://localhost:8181/api/progress/${progressId}/cancel`, {
       method: 'POST'
     });
     clearInterval(pollingInterval);
   };
   ```

4. **Auto-refresh on completion:**
   ```typescript
   const handleComplete = (data) => {
     toast.success(`Document uploaded successfully: ${data.filename}`);
     queryClient.invalidateQueries(['project-documents', projectId]);
   };
   ```

**UI Mockup:**
```
┌──────────────────────────────────────┐
│  Uploading document.pdf...           │
├──────────────────────────────────────┤
│  ████████████░░░░░░░░░░░░ 65%        │
│  Extracting text from document...    │
│  [Cancel Upload]                     │
└──────────────────────────────────────┘
```

**Reuse Patterns:**
- Copy from `CrawlingProgress.tsx` in knowledge base
- Adapt for document uploads
- Same polling logic

**Deliverables:**
- DocumentProgressMonitor component
- Progress polling implementation
- Cancel functionality
- Auto-refresh on completion
- Success/error notifications

---

### Phase 6.7: Test File Upload and URL Crawl Workflows
**Assignee:** testing-expert
**Estimated:** 2.0 hours
**Status:** Backlog

**Test Scenarios:**

1. **File Upload - Project Private:**
   - Upload PDF file with drag-and-drop
   - Set knowledge_type = "technical"
   - Add tags: ["documentation", "api"]
   - Enable extract_code_examples
   - Check is_project_private = true
   - Uncheck send_to_kb
   - Verify progress monitoring
   - Verify document appears in project list with "Private" badge
   - Verify NOT in global knowledge base

2. **File Upload - Send to KB:**
   - Upload DOCX file
   - Set knowledge_type = "business"
   - Check send_to_kb = true
   - Verify progress monitoring
   - Verify document appears in project list with "Global KB" badge
   - Verify promoted_to_kb_at and promoted_by are set
   - Verify appears in global knowledge base

3. **URL Crawl - Project Private:**
   - Enter URL: https://docs.example.com
   - Set max_depth = 3
   - Enable extract_code_examples
   - Check is_project_private = true
   - Verify progress monitoring with page counts
   - Verify pages stored with project_id
   - Verify code examples extracted

4. **URL Crawl - Send to KB:**
   - Enter URL: https://example.com/api-guide
   - Set max_depth = 2
   - Check send_to_kb = true
   - Verify crawl completes
   - Verify pages in global KB
   - Verify source in archon_sources with promoted fields

5. **Error Handling:**
   - Upload invalid file type (.exe)
   - Upload empty file
   - Enter invalid URL
   - Test cancel during upload/crawl
   - Test network error during upload
   - Test API key validation failure

6. **Progress Monitoring:**
   - Verify progress updates every second
   - Verify status changes (initializing → processing → storing → completed)
   - Verify log messages update
   - Verify cancel stops operation
   - Verify completion auto-refreshes document list

7. **Privacy Controls:**
   - Verify is_project_private checkbox controls document.is_project_private
   - Verify send_to_kb checkbox sets promoted_to_kb_at
   - Verify promoted_by contains current user
   - Verify private documents only visible in project
   - Verify global KB documents visible everywhere

**Deliverables:**
- Test report with pass/fail results
- Screenshots of successful workflows
- Bug reports for any failures
- Performance metrics (upload speed, progress accuracy)

---

## 📊 Updated Project Status

### Document Management Subproject
**Project ID:** f8311680-58a7-45e6-badf-de55d3d9cd24

**Before Phase 6:**
- Total: 22 tasks
- Done: 10 tasks (45%)
- Backlog: 12 tasks

**After Phase 6 Planning:**
- Total: **29 tasks** (+7 new tasks)
- Done: 10 tasks (34%)
- Backlog: **19 tasks**

**Completed Phases:**
- ✅ Phase 1: Database migration (2 tasks)
- ✅ Phase 2: Backend service (1 task)
- ✅ Phase 3: API endpoints (3 tasks)
- ✅ Phase 4: Frontend UI components (3 tasks)
- ✅ Phase 5.2: Integration (1 task)

**New Phase:**
- 🆕 **Phase 6: Enhanced Upload (KB Integration)** (7 tasks)
  - 6.1: Research KB upload (1.0 hr)
  - 6.2: EnhancedDocumentUpload component (3.0 hr)
  - 6.3: File upload backend (2.5 hr)
  - 6.4: URL crawl backend (2.0 hr)
  - 6.5: Integration (2.0 hr)
  - 6.6: Progress monitoring (2.5 hr)
  - 6.7: Testing (2.0 hr)
  - **Total:** 15.0 hours estimated

**Remaining Original Phases:**
- Phase 5.1: React Query hooks (optional)
- Phase 7: Testing (original, 2 tasks)
- Phase 8: Documentation (2 tasks)
- Phase 9: Performance (2 tasks)
- Phase 10: Deployment (2 tasks)

---

## 🎯 Success Criteria

### Technical
- ✅ Drag-and-drop file upload working
- ✅ URL crawling with project scoping working
- ✅ Progress tracking for both uploads and crawls
- ✅ Privacy controls (project-private vs global KB)
- ✅ Send to KB checkbox functional
- ✅ Metadata fields (knowledge_type, tags, extract_code_examples) captured
- ✅ Same upload model as knowledge base
- ✅ RBAC protection on all endpoints

### User Experience
- ✅ Intuitive two-tab interface (URL vs File)
- ✅ Clear privacy options with tooltips
- ✅ Real-time progress feedback
- ✅ Success/error notifications
- ✅ Auto-refresh on completion
- ✅ Cancel functionality
- ✅ Dark mode support

### Performance
- ✅ File upload <5 seconds for <10MB files
- ✅ Progress updates every 1 second
- ✅ Background processing doesn't block UI
- ✅ Efficient text extraction
- ✅ Concurrent crawl support

---

## 🔄 Next Steps

### Immediate
1. **Mark Phase 6.1 as doing** - Start KB upload research
2. **Assign to codebase-analyst** - Analyze AddSourceDialog and upload endpoints
3. **Create architecture document** - Document findings for team

### Sequential Execution (Recommended)
```
Phase 6.1 (Research - 1hr)
    ↓
Phase 6.2 (Frontend Component - 3hr) + Phase 6.3 (Upload Backend - 2.5hr) [Parallel]
    ↓
Phase 6.4 (Crawl Backend - 2hr)
    ↓
Phase 6.5 (Integration - 2hr)
    ↓
Phase 6.6 (Progress Monitoring - 2.5hr)
    ↓
Phase 6.7 (Testing - 2hr)
```

**Total Estimated Time:** 15 hours (2 work days for sequential, ~1.5 days with parallelization)

---

## 📚 References

### Knowledge Base Components
- `src/components/KnowledgeBase/AddSourceDialog.tsx` - Upload UI reference
- `src/components/KnowledgeBase/CrawlingProgress.tsx` - Progress monitoring reference
- `src/components/KnowledgeBase/KnowledgeSourceCard.tsx` - Document card reference

### Backend Endpoints
- `python/src/server/api_routes/knowledge_api.py` - Upload/crawl endpoints
- `python/src/server/services/storage.py` - DocumentStorageService
- `python/src/server/services/crawling/` - CrawlingService

### Project Documents (Current)
- `archon-ui-nextjs/src/features/projects/components/ProjectDocumentsTab.tsx`
- `archon-ui-nextjs/src/features/projects/components/DocumentUploadDropzone.tsx`
- `python/src/server/api_routes/projects_documents.py`

### Database Schema
- `migration/0.5.0/011_add_project_documents.sql` - Project scoping migration

---

**Plan Created:** 2026-01-23 16:30 UTC
**Tasks Created:** 7 tasks (Phase 6.1 - 6.7)
**Total Estimated Effort:** 15.0 hours
**Status:** ✅ Ready for implementation
**Next Action:** Assign Phase 6.1 to codebase-analyst and mark as "doing"
