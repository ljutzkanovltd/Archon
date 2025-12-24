# Icon Standards - Archon Next.js Dashboard

## Standard Icon Library

**PRIMARY LIBRARY**: `react-icons/hi2` (Heroicons 2)

All icons across the application MUST use `react-icons/hi2` for consistency.

## Icon Import Pattern

```typescript
import {
  HiIconName1,
  HiIconName2
} from "react-icons/hi2";
```

## Common Icons Reference

| Purpose | Icon Name (hi2) | Usage |
|---------|----------------|-------|
| **Navigation** |
| Menu/Hamburger | `HiBars3` | Mobile menu toggle |
| Close/X | `HiXMark` | Close dialogs, dismiss |
| Arrow Left | `HiArrowLeft` | Back navigation |
| Chevron Left | `HiChevronLeft` | Pagination prev |
| Chevron Right | `HiChevronRight` | Pagination next |
| Chevron Down | `HiChevronDown` | Dropdown expand |
| Chevron Up | `HiChevronUp` | Dropdown collapse |
| **Actions** |
| Check/Success | `HiCheck` | Confirm, success state |
| Save | `HiCheckCircle` | Save action (use filled variant) |
| Edit/Pencil | `HiPencilSquare` | Edit action |
| Delete/Trash | `HiTrash` | Delete action |
| Add/Plus | `HiPlus` | Add new item |
| Refresh | `HiArrowPath` | Refresh/reload |
| **Status** |
| Success Circle | `HiCheckCircle` | Success indicator |
| Error Circle | `HiXCircle` | Error indicator |
| Warning | `HiExclamationTriangle` | Warning state |
| Info | `HiExclamationCircle` | Info state |
| **Visibility** |
| Eye Open | `HiEye` | Show/visible |
| Eye Closed | `HiEyeSlash` | Hide/hidden |
| **Settings** |
| Settings/Cog | `HiCog6Tooth` | Settings page |
| Key | `HiKey` | API keys, auth |
| Globe | `HiGlobeAlt` | Web/crawl |
| Database | `HiCircleStack` | Database |
| Code | `HiCodeBracket` | Code-related |
| Bell | `HiBell` | Notifications |
| Lightning | `HiBolt` | Features/fast |
| **Content** |
| Folder | `HiFolder` | Project folders |
| Document | `HiDocument` | Documents |
| Clipboard | `HiClipboardDocumentList` | Tasks |
| Archive | `HiArchiveBox` | Archive |
| Search | `HiMagnifyingGlass` | Search |
| Tag | `HiTag` | Tags |
| **Views** |
| Grid View | `HiSquares2X2` | Grid layout |
| List View | `HiListBullet` | List layout |
| Table View | `HiTableCells` | Table layout |
| **Users** |
| User | `HiUser` | Single user |
| User Group | `HiUserGroup` | Multiple users |
| **Other** |
| Clock | `HiClock` | Time/date |
| Calendar | `HiCalendar` | Date picker |
| Terminal | `HiCommandLine` | Technical/code |
| Briefcase | `HiBriefcase` | Business |
| Sun | `HiSun` | Light mode |
| Moon | `HiMoon` | Dark mode |
| Bug | `HiBug` | Bug reports |

## Migration from hi to hi2

### Icon Name Mappings

| Old (hi) | New (hi2) | Notes |
|----------|-----------|-------|
| `HiMenu` | `HiBars3` | Hamburger menu |
| `HiX` | `HiXMark` | Close/dismiss |
| `HiChevronLeft` | `HiChevronLeft` | Same name |
| `HiChevronRight` | `HiChevronRight` | Same name |
| `HiChevronDown` | `HiChevronDown` | Same name |
| `HiChevronUp` | `HiChevronUp` | Same name |
| `HiCheck` | `HiCheck` | Same name |
| `HiCheckCircle` | `HiCheckCircle` | Same name |
| `HiXCircle` | `HiXCircle` | Same name |
| `HiEye` | `HiEye` | Same name |
| `HiEyeOff` | `HiEyeSlash` | Name changed |
| `HiPencil` | `HiPencilSquare` | Name changed |
| `HiTrash` | `HiTrash` | Same name |
| `HiPlus` | `HiPlus` | Same name |
| `HiRefresh` | `HiArrowPath` | Name changed |
| `HiSave` | `HiCheckCircle` | Use filled variant |
| `HiCog` | `HiCog6Tooth` | Name changed |
| `HiKey` | `HiKey` | Same name |
| `HiGlobe` | `HiGlobeAlt` | Name changed |
| `HiGlobeAlt` | `HiGlobeAlt` | Same name |
| `HiDatabase` | `HiCircleStack` | Name changed |
| `HiCode` | `HiCodeBracket` | Name changed |
| `HiBell` | `HiBell` | Same name |
| `HiLightningBolt` | `HiBolt` | Name changed |
| `HiFolder` | `HiFolder` | Same name |
| `HiDocument` | `HiDocument` | Same name |
| `HiClipboardList` | `HiClipboardDocumentList` | Name changed |
| `HiArchive` | `HiArchiveBox` | Name changed |
| `HiSearch` | `HiMagnifyingGlass` | Name changed |
| `HiTag` | `HiTag` | Same name |
| `HiViewGrid` | `HiSquares2X2` | Name changed |
| `HiViewList` | `HiListBullet` | Name changed |
| `HiDotsVertical` | `HiEllipsisVertical` | Name changed |
| `HiUser` | `HiUser` | Same name |
| `HiUserGroup` | `HiUserGroup` | Same name |
| `HiClock` | `HiClock` | Same name |
| `HiStop` | `HiStop` | Same name |
| `HiBriefcase` | `HiBriefcase` | Same name |
| `HiTerminal` | `HiCommandLine` | Name changed |
| `HiSun` | `HiSun` | Same name |
| `HiMoon` | `HiMoon` | Same name |
| `HiBug` | `HiBug` | Same name |
| `HiExclamationTriangle` | `HiExclamationTriangle` | Same name |
| `HiArrowPath` | `HiArrowPath` | Same name |
| `HiStatusOnline` | `HiSignal` | Name changed |
| `HiStatusOffline` | `HiSignalSlash` | Name changed |
| `HiArrowLeft` | `HiArrowLeft` | Same name |
| `HiUpload` | `HiArrowUpTray` | Name changed |
| `HiOutlineFolder` | `HiFolder` | Remove Outline prefix, use base |
| `HiOutlineClipboardList` | `HiClipboardDocumentList` | Remove Outline prefix |
| `HiOutlineUserGroup` | `HiUserGroup` | Remove Outline prefix |
| `HiOutlineCheckCircle` | `HiCheckCircle` | Remove Outline prefix |
| `HiOutlineUser` | `HiUser` | Remove Outline prefix |
| `HiOutlineCog` | `HiCog6Tooth` | Remove Outline prefix |

## Implementation Guidelines

1. **Import statements**: Always from `react-icons/hi2`
2. **Outline vs Solid**: By default, use the base icon (outline style). For emphasis, use the `Solid` suffix (e.g., `HiCheckCircleSolid`)
3. **Sizing**: Use Tailwind classes like `h-4 w-4`, `h-5 w-5`, `h-6 w-6`
4. **Colors**: Use Tailwind text colors like `text-gray-500`, `text-brand-600`
5. **Consistency**: Use the same icon for the same action across the app

## Files Migrated

The following files have been migrated to use react-icons/hi2:

- [ ] `src/components/Sidebar.tsx`
- [ ] `src/components/Header.tsx`
- [ ] `src/components/Projects/ProjectCard.tsx`
- [ ] `src/components/Projects/ProjectWithTasksCard.tsx`
- [ ] `src/components/Projects/tasks/views/TaskTableView.tsx`
- [ ] `src/components/Tasks/TaskCard.tsx`
- [ ] `src/components/Tasks/TaskModal.tsx`
- [ ] `src/components/KnowledgeBase/*.tsx` (all files)
- [ ] `src/app/page.tsx`
- [ ] `src/app/settings/page.tsx`
- [ ] `src/app/settings/components/*.tsx` (all files except RAGSettingsTab.tsx - already correct)
- [ ] `src/app/projects/**/*.tsx` (all project pages)
- [ ] `src/app/knowledge-base/page.tsx`
- [ ] `src/app/mcp-inspector/page.tsx`
- [ ] `src/components/common/DataTable/*.tsx` (all DataTable files)
- [ ] `src/components/ReactIcons.tsx` (centralized icon exports)

## Date Created

2025-12-24

## Last Updated

2025-12-24
