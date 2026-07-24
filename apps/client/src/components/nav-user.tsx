"use client";

import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOutIcon, UserRoundIcon } from "lucide-react";

export function NavUser() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Avatar className="size-8" />} nativeButton={false} aria-label="Open user menu">
        <AvatarFallback>
          <UserAvatar profile={profile} userId={user?.id} size="sm" />
        </AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="size-10">
            <AvatarFallback>
              <UserAvatar profile={profile} userId={user?.id} size="md" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium">
              {profile ? `${profile.firstName} ${profile.lastName}` : "Not signed in"}
            </span>
            {profile && (
              <span className="truncate text-xs text-muted-foreground">
                {profile.email}
              </span>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate("/profile")}>
            <UserRoundIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
