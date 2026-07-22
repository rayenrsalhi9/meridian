import { UserIcon } from "lucide-react"
import { getAvatarColor, getInitials } from "@/lib/user-utils"

const sizeConfig = {
  sm: { span: "size-8 text-xs", icon: "size-4" },
  md: { span: "size-10 text-sm", icon: "size-4" },
  lg: { span: "size-16 text-lg", icon: "" },
} as const

export type AvatarSize = keyof typeof sizeConfig

interface UserAvatarProps {
  profile: { firstName: string; lastName: string } | null
  userId?: string
  size?: AvatarSize
}

export function UserAvatar({
  profile,
  userId,
  size = "md",
}: UserAvatarProps) {
  if (!profile) {
    return <UserIcon className={sizeConfig[size].icon} />
  }

  return (
    <span
      className={`flex items-center justify-center rounded-full font-medium text-white ${sizeConfig[size].span} ${userId ? getAvatarColor(userId) : ""}`}
      aria-hidden="true"
    >
      {getInitials(profile.firstName, profile.lastName)}
    </span>
  )
}
