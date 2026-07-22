export const ADMIN_CLAIM_KEYS = ["ROLE_MANAGE", "USER_MANAGE"] as const;
export const ADMIN_CLAIM_KEYS_SET: ReadonlySet<string> = new Set(ADMIN_CLAIM_KEYS);

export const CLAIM_CATEGORIES = [
  "Documents",
  "Forums",
  "Chat",
  "Users",
  "Roles",
  "Dashboard",
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export interface ClaimDefinition {
  label: string;
  category: ClaimCategory;
}

export const CLAIM_DEFINITIONS: Record<string, ClaimDefinition> = {
  DOCUMENT_CREATE: { label: "Create documents", category: "Documents" },
  DOCUMENT_MANAGE: { label: "Manage documents", category: "Documents" },
  DOCUMENT_CATEGORY_MANAGE: {
    label: "Manage document categories",
    category: "Documents",
  },
  FORUM_VIEW: { label: "View forums", category: "Forums" },
  FORUM_MANAGE: { label: "Manage forums", category: "Forums" },
  FORUM_CATEGORY_MANAGE: {
    label: "Manage forum categories",
    category: "Forums",
  },
  CHAT_MODERATE: { label: "Moderate chat", category: "Chat" },
  USER_MANAGE: { label: "Manage users", category: "Users" },
  ROLE_MANAGE: { label: "Manage roles", category: "Roles" },
  DASHBOARD_VIEW: { label: "View dashboard", category: "Dashboard" },
};

export function getClaimLabel(key: string): string {
  return CLAIM_DEFINITIONS[key]?.label ?? key;
}


