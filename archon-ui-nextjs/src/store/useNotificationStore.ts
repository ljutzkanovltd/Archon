import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "task";
  is_read: boolean;
  created_at: string;
  link?: string;
  user_name?: string;
  user_avatar?: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, "id" | "is_read" | "created_at">) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });

    try {
      // TODO: Implement backend API call
      // For now, using mock data to match SportERP pattern
      const mockNotifications: Notification[] = [
        {
          id: "1",
          title: "Task Assignment",
          message: "You have been assigned to implement user profile page",
          type: "task",
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          link: "/tasks/1",
          user_name: "System",
        },
        {
          id: "2",
          title: "Crawl Complete",
          message: "Documentation crawl completed successfully. 150 pages indexed.",
          type: "success",
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          link: "/knowledge",
        },
        {
          id: "3",
          title: "Profile Updated",
          message: "Your profile information has been updated",
          type: "info",
          is_read: true,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          link: "/settings/profile",
        },
      ];

      const unreadCount = mockNotifications.filter((n) => !n.is_read).length;

      set({
        notifications: mockNotifications,
        unreadCount,
        isLoading: false
      });
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      // TODO: Implement backend API call
      // For now, just update locally
      const notifications = get().notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );

      const unreadCount = notifications.filter((n) => !n.is_read).length;

      set({ notifications, unreadCount });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  },

  markAllAsRead: async () => {
    try {
      // TODO: Implement backend API call
      // For now, just update locally
      const notifications = get().notifications.map((n) => ({
        ...n,
        is_read: true,
      }));

      set({ notifications, unreadCount: 0 });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  },

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
