"use client";

import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import { getInitials, getAvatarColor } from "@/lib/user-utils";

export function NavUser() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Avatar className="size-8" />} nativeButton={false}>
        <AvatarFallback>
          {profile ? (
            <span
              className={`flex size-8 items-center justify-center rounded-full text-xs font-medium text-white ${user ? getAvatarColor(user.id) : ""}`}
            >
              {getInitials(profile.firstName, profile.lastName)}
            </span>
          ) : (
            <UserIcon className="size-4" />
          )}
        </AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="size-10">
            <AvatarFallback>
              {profile ? (
                <span
                  className={`flex size-10 items-center justify-center rounded-full text-sm font-medium text-white ${user ? getAvatarColor(user.id) : ""}`}
                >
                  {getInitials(profile.firstName, profile.lastName)}
                </span>
              ) : (
                <UserIcon className="size-4" />
              )}
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
            See Profile
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
