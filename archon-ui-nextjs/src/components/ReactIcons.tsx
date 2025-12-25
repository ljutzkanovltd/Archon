import { IconName } from "@/lib/types";
import { IconBaseProps } from "react-icons";
import { ImSpinner } from "react-icons/im";
import {
  HiPlus,
  HiX,
  HiCheck,
  HiChevronUp,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiFilter,
  HiSearch,
  HiMenu,
  HiViewGrid,
  HiEye,
  HiEyeOff,
  HiPencil,
  HiTrash,
  HiRefresh,
  HiDownload,
  HiUpload,
  HiDuplicate,
  HiLockClosed,
  HiCog,
  HiChartBar,
  HiHome,
  HiDocumentText,
  HiUserGroup,
  HiFolder,
  HiAcademicCap,
  HiShoppingBag,
  HiCalendar,
  HiBell,
  HiUsers,
  HiBookmark,
  HiChatAlt2,
  HiNewspaper,
  HiQuestionMarkCircle,
  HiSortAscending,
  HiSortDescending,
  HiPlay,
  HiPause,
} from "react-icons/hi";
import { MdEditSquare } from "react-icons/md";
import { FaRegTrashAlt } from "react-icons/fa";

// Icon mapping object
const iconMap: Record<IconName, React.ComponentType<IconBaseProps>> = {
  // Basic actions
  PLUS: HiPlus,
  CLOSE: HiX,
  CHECK: HiCheck,

  // Arrows
  ARROW_UP: HiChevronUp,
  ARROW_DOWN: HiChevronDown,
  ARROW_LEFT: HiChevronLeft,
  ARROW_RIGHT: HiChevronRight,

  // Common actions
  FILTER: HiFilter,
  SEARCH: HiSearch,
  MENU: HiMenu,
  GRID: HiViewGrid,
  EYE: HiEye,
  EYEOFF: HiEyeOff,
  EDIT: HiPencil,
  TRASH: HiTrash,
  MDEDITSQUARE: MdEditSquare,
  FAREGTRASHALT: FaRegTrashAlt,
  SPINNER: ImSpinner,
  REFRESH: HiRefresh,
  DOWNLOAD: HiDownload,
  UPLOAD: HiUpload,
  COPY: HiDuplicate,
  LOCK: HiLockClosed,
  SETTINGS: HiCog,

  // Navigation
  CHART: HiChartBar,
  DASHBOARD: HiHome,
  DOCUMENTS: HiDocumentText,
  USERS: HiUserGroup,
  PROJECTS: HiFolder,
  COURSES: HiAcademicCap,
  SHOP_PRODUCT: HiShoppingBag,
  CALENDER: HiCalendar,
  NOTIFICATIONS: HiBell,
  GROUPS: HiUsers,
  SUBSCRIPTIONS: HiBookmark,
  MESSAGES: HiChatAlt2,
  NEWS_FEED: HiNewspaper,
  BOOKMARKS: HiBookmark,
  ANALYSIS: HiChartBar,
  TUTORIALS: HiAcademicCap,
  HELP: HiQuestionMarkCircle,

  // Sort
  SORT: HiSortAscending,
  SORT_UP: HiSortAscending,
  SORT_DOWN: HiSortDescending,

  // Media
  PLAY: HiPlay,
  PAUSE: HiPause,
  QUESTION: HiQuestionMarkCircle,
};

interface ReactIconsProps extends Omit<IconBaseProps, "color"> {
  icon: IconName;
  size?: number;
  color?: string;
}

const ReactIcons: React.FC<ReactIconsProps> = ({
  icon,
  size = 20,
  color,
  className = "",
  ...props
}) => {
  const IconComponent = iconMap[icon];

  if (!IconComponent) {
    console.warn(`Icon "${icon}" not found in iconMap`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      {...props}
    />
  );
};

export default ReactIcons;
