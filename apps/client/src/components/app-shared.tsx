import type { ReactNode } from "react";
import {
  LayoutDashboardIcon,
  FileTextIcon,
  MessageSquareIcon,
  MessageCircleIcon,
  UsersIcon,
  ShieldIcon,
  HelpCircleIcon,
  ActivityIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", path: "/", icon: <LayoutDashboardIcon /> },
      { title: "Documents", path: "/documents", icon: <FileTextIcon /> },
      { title: "Chat", path: "/chat", icon: <MessageSquareIcon /> },
      { title: "Forums", path: "/forums", icon: <MessageCircleIcon /> },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Users", path: "/admin/users", icon: <UsersIcon /> },
      { title: "Roles", path: "/admin/roles", icon: <ShieldIcon /> },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Help Center",
    path: "/help",
    icon: <HelpCircleIcon />,
  },
  {
    title: "System status",
    path: "/status",
    icon: <ActivityIcon />,
  },
];

function matchesPath(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

function activeGroups(pathname: string, groups: SidebarNavGroup[]): SidebarNavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      isActive: item.path ? matchesPath(pathname, item.path) : false,
      subItems: item.subItems?.map((sub) => ({
        ...sub,
        isActive: pathname === sub.path,
      })),
    })),
  }));
}

function findActivePage(
  pathname: string,
  groups: SidebarNavGroup[],
  footer: SidebarNavItem[],
): SidebarNavItem | null {
  for (const group of groups) {
    for (const item of group.items) {
      const sub = item.subItems?.find((s) => s.path === pathname);
      if (sub) return sub;
      if (item.path && matchesPath(pathname, item.path)) return item;
    }
  }
  return footer.find((item) => item.path === pathname) ?? null;
}

export function computeNavState(pathname: string, groups: SidebarNavGroup[], footer: SidebarNavItem[]) {
  return { groups: activeGroups(pathname, groups), activePage: findActivePage(pathname, groups, footer) };
}
