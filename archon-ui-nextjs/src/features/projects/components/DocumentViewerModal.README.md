# DocumentViewerModal Component

A comprehensive document viewer modal component with multi-format support for Archon dashboard.

## Features

- **Multi-Format Support**: View markdown, text, PDF, images, and code files
- **Syntax Highlighting**: Automatic language detection and syntax highlighting for code files
- **PDF Navigation**: Multi-page PDF support with page navigation controls
- **Image Zoom**: Pan, zoom, and pinch controls for images
- **Dark Mode**: Automatic dark mode detection and styling
- **Responsive Design**: Mobile-friendly with responsive layouts
- **Keyboard Support**: ESC key to close modal
- **Download Support**: Download any document directly from viewer
- **Error Handling**: Graceful error states for unsupported formats or load failures
- **Loading States**: Visual feedback during document loading

## Installation

The component requires the following dependencies (already installed):

```bash
npm install react-markdown@^10.1.0
npm install react-pdf@^7.7.0
npm install react-zoom-pan-pinch@^3.4.0
npm install react-syntax-highlighter@^15.5.0 @types/react-syntax-highlighter
```

## Usage

### Basic Usage

```typescript
import { useState } from "react";
import { DocumentViewerModal } from "@/features/projects/components";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  const document = {
    filename: "README.md",
    file_type: "markdown",
    content: "# Hello World\n\nThis is markdown content.",
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>View Document</button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={document}
      />
    </>
  );
}
```

### Props Interface

```typescript
interface DocumentViewerModalProps {
  isOpen: boolean;              // Control modal visibility
  onClose: () => void;          // Callback when modal closes
  document: {
    filename: string;           // Display name (e.g., "README.md")
    file_type: "pdf" | "markdown" | "text" | "image" | "code";
    mime_type?: string;         // MIME type (e.g., "image/png")
    content: string;            // File content (text, base64, etc.)
    file_path?: string;         // Optional: Path for PDF files
  } | null;                     // null when no document selected
}
```

## Supported File Types

### 1. Markdown (`file_type: "markdown"`)

Renders markdown with full formatting support using `react-markdown`.

```typescript
{
  filename: "README.md",
  file_type: "markdown",
  content: "# Title\n\n- List item 1\n- List item 2"
}
```

**Features**:
- Headers, lists, links, emphasis
- Code blocks with syntax highlighting
- Tables, blockquotes
- Dark mode support

### 2. Plain Text (`file_type: "text"`)

Displays plain text with preserved formatting (whitespace, line breaks).

```typescript
{
  filename: "notes.txt",
  file_type: "text",
  content: "Line 1\nLine 2\nLine 3"
}
```

**Features**:
- Preserved whitespace
- Monospace font
- Scrollable content area

### 3. PDF (`file_type: "pdf"`)

Renders PDF documents with page navigation using `react-pdf`.

```typescript
{
  filename: "document.pdf",
  file_type: "pdf",
  file_path: "/path/to/document.pdf",  // or base64 data URL
  content: ""  // Can be empty if file_path is provided
}
```

**Features**:
- Multi-page navigation
- Page counter
- Previous/Next buttons
- Text layer support
- Annotation layer support

### 4. Images (`file_type: "image"`)

Displays images with zoom, pan, and pinch controls using `react-zoom-pan-pinch`.

```typescript
{
  filename: "diagram.png",
  file_type: "image",
  mime_type: "image/png",
  content: "data:image/png;base64,iVBOR..."  // Data URL or base64
}
```

**Features**:
- Zoom in/out controls
- Pan and drag
- Reset transform
- Touch gestures (pinch-to-zoom)

**Supported image formats**: PNG, JPG, GIF, SVG, WebP

### 5. Code (`file_type: "code"`)

Syntax-highlighted code viewer using `react-syntax-highlighter`.

```typescript
{
  filename: "example.tsx",
  file_type: "code",
  content: "function hello() {\n  console.log('Hello');\n}"
}
```

**Features**:
- Auto-detects language from file extension
- Syntax highlighting (40+ languages)
- Line numbers
- Dark/light theme support

**Supported languages**: JavaScript, TypeScript, Python, Java, Go, Rust, C++, C#, PHP, Ruby, Swift, Kotlin, SQL, HTML, CSS, YAML, JSON, Markdown, Bash, and more.

## Language Detection

The component automatically detects programming language from file extension:

| Extension | Language |
|-----------|----------|
| `.js`, `.jsx` | JavaScript |
| `.ts`, `.tsx` | TypeScript |
| `.py` | Python |
| `.java` | Java |
| `.go` | Go |
| `.rs` | Rust |
| `.cpp`, `.c` | C/C++ |
| `.cs` | C# |
| `.php` | PHP |
| `.rb` | Ruby |
| `.swift` | Swift |
| `.kt` | Kotlin |
| `.sh`, `.bash` | Bash |
| `.sql` | SQL |
| `.json` | JSON |
| `.yaml`, `.yml` | YAML |
| `.html` | HTML |
| `.css`, `.scss` | CSS/SCSS |
| `.md` | Markdown |

## Dark Mode Support

The component automatically detects system dark mode preference and applies appropriate styling:

- Markdown: Dark prose styles
- Code: `vscDarkPlus` theme (dark) / `vs` theme (light)
- Text: Dark background and text colors
- Modal: Dark border and background colors

## Error Handling

### Unsupported File Type

If a file type is not supported, the component displays:

```
⚠️ Preview not available for this file type
File type: [type]
```

### Load Failure

If document loading fails, the component shows:

```
❌ Failed to load document
Error: [error message]
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ESC` | Close modal |

## Download Functionality

The component includes a download button that:
1. Creates a blob from document content
2. Triggers browser download
3. Uses original filename
4. Respects MIME type

```typescript
const handleDownload = () => {
  const blob = new Blob([document.content], {
    type: document.mime_type || "text/plain",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = document.filename;
  link.click();
  URL.revokeObjectURL(url);
};
```

## Responsive Design

The component adapts to different screen sizes:

- **Desktop**: Large modal (`max-w-4xl`), full feature set
- **Tablet**: Medium modal, scrollable content
- **Mobile**: Full-width modal, touch gestures for images

**Max height**: `70vh` (70% of viewport height) with scrollable content area.

## Integration Examples

### Example 1: Document List

```typescript
function DocumentList({ documents }: { documents: Document[] }) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  return (
    <div>
      {documents.map((doc) => (
        <button key={doc.id} onClick={() => setSelectedDoc(doc)}>
          {doc.filename}
        </button>
      ))}

      <DocumentViewerModal
        isOpen={selectedDoc !== null}
        onClose={() => setSelectedDoc(null)}
        document={selectedDoc}
      />
    </div>
  );
}
```

### Example 2: Fetch from API

```typescript
function DocumentViewer({ documentId }: { documentId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [document, setDocument] = useState(null);

  const fetchDocument = async () => {
    const response = await fetch(`/api/documents/${documentId}`);
    const data = await response.json();
    setDocument({
      filename: data.filename,
      file_type: data.file_type,
      content: data.content,
    });
    setIsOpen(true);
  };

  return (
    <>
      <button onClick={fetchDocument}>View</button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={document}
      />
    </>
  );
}
```

### Example 3: Project Documents Tab

```typescript
function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  const { data: documents } = useQuery(["documents", projectId], fetchDocuments);
  const [viewingDoc, setViewingDoc] = useState(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {documents?.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onView={() => setViewingDoc(doc)}
          />
        ))}
      </div>

      <DocumentViewerModal
        isOpen={viewingDoc !== null}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
      />
    </div>
  );
}
```

## Styling

The component uses Flowbite and Tailwind CSS classes:

- Modal: Flowbite `<Modal>` component
- Content: Tailwind utility classes
- Dark mode: `dark:` prefix classes
- Responsive: Tailwind breakpoints (`md:`, `lg:`)

### Customization

To customize styling, you can:

1. **Override Tailwind classes**: Modify `className` props in component
2. **Custom themes**: Provide custom syntax highlighter themes
3. **Modal size**: Change `size` prop on `<Modal>` (default: `4xl`)

## Testing

Test file: `__tests__/DocumentViewerModal.test.tsx`

Run tests:
```bash
npm run test DocumentViewerModal.test.tsx
```

**Test coverage**:
- Modal open/close behavior
- Document type rendering
- Close button functionality
- Download functionality
- Error states
- Language detection

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |

**Notes**:
- PDF.js requires modern browsers with ES6 support
- Image zoom requires touch event support for mobile

## Performance Considerations

- **Lazy loading**: PDF pages loaded on demand
- **Code splitting**: Syntax highlighter loaded dynamically
- **Memory**: Large PDFs may use significant memory
- **Render optimization**: React.memo for expensive renders

## Troubleshooting

### PDF not loading

**Symptom**: PDF viewer shows blank or error
**Solution**: Ensure `pdfjs.GlobalWorkerOptions.workerSrc` is set correctly

```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
```

### Image not displaying

**Symptom**: Image shows broken icon
**Solution**: Ensure `content` is a valid data URL with proper MIME type

```typescript
content: `data:image/png;base64,${base64String}`
```

### Syntax highlighting not working

**Symptom**: Code displays as plain text
**Solution**: Verify file extension is in language map and `react-syntax-highlighter` is installed

## Files

- **Component**: `DocumentViewerModal.tsx`
- **Tests**: `__tests__/DocumentViewerModal.test.tsx`
- **Examples**: `DocumentViewerModal.example.tsx`
- **Documentation**: `DocumentViewerModal.README.md`

## Export

The component is exported from the features index:

```typescript
export { DocumentViewerModal } from "./DocumentViewerModal";
```

Import from:
```typescript
import { DocumentViewerModal } from "@/features/projects/components";
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | ^10.1.0 | Markdown rendering |
| `react-pdf` | ^7.7.0 | PDF viewing |
| `react-zoom-pan-pinch` | ^3.4.0 | Image zoom controls |
| `react-syntax-highlighter` | ^15.5.0 | Code syntax highlighting |
| `@types/react-syntax-highlighter` | latest | TypeScript types |
| `flowbite-react` | ^0.12.13 | Modal component |
| `lucide-react` | ^0.562.0 | Icons |

## License

Part of Archon dashboard project. See project LICENSE for details.

## Related Components

- `ProjectDocumentsTab`: Project documents management
- `EnhancedDocumentUpload`: Document upload functionality
- `DocumentPrivacyBadge`: Document privacy indicators

## Future Enhancements

Potential improvements:
- [ ] Office document support (.docx, .xlsx, .pptx)
- [ ] Video/audio playback
- [ ] Full-screen mode
- [ ] Print functionality
- [ ] Annotation tools
- [ ] Text search within documents
- [ ] Multi-document comparison view
- [ ] Document history/versioning UI

## Changelog

### v1.0.0 (2026-01-26)
- Initial release
- Multi-format support (markdown, text, PDF, image, code)
- Dark mode support
- Responsive design
- Download functionality
- ESC key support
- Comprehensive error handling
