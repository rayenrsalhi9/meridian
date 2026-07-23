import { useCallback, useEffect, useMemo, useState } from "react"
import {
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  SearchIcon,
  XIcon,
  CheckIcon,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ADMIN_CLAIM_KEYS_SET, PASSWORD_RULES } from "shared"
import { getAvatarColor, getInitials, formatDate } from "@/lib/user-utils"

const ADMIN_CLAIM_KEYS = ADMIN_CLAIM_KEYS_SET

interface UserItem {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  roles: Array<{ id: string; name: string }>
}

interface RoleItem {
  id: string
  name: string
  description: string | null
  createdAt: string
  claims: string[]
  userCount: number
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formFirstName, setFormFirstName] = useState("")
  const [formLastName, setFormLastName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formPasswordConfirm, setFormPasswordConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [resettingUser, setResettingUser] = useState<UserItem | null>(null)
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const [deactivatingUser, setDeactivatingUser] = useState<UserItem | null>(
    null,
  )
  const [deactivating, setDeactivating] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiClient("/users?includeInactive=true"),
        apiClient("/roles"),
      ])
      if (!usersRes.ok) {
        throw new Error(usersRes.status === 403 ? "Forbidden: Insufficient permissions" : `Failed to fetch users: ${usersRes.statusText}`)
      }
      if (!rolesRes.ok) {
        throw new Error(rolesRes.status === 403 ? "Forbidden: Insufficient permissions" : `Failed to fetch roles: ${rolesRes.statusText}`)
      }
      const rolesData: RoleItem[] = await rolesRes.json()
      setRoles(rolesData)
      const usersData: UserItem[] = await usersRes.json()
      setUsers(usersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const adminRoleIds = useMemo(() => {
    return new Set(
      roles
        .filter((r) => r.claims.some((c) => ADMIN_CLAIM_KEYS.has(c)))
        .map((r) => r.id),
    )
  }, [roles])

  function isUserAdmin(user: UserItem): boolean {
    return user.roles.some((r) => adminRoleIds.has(r.id))
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          user.firstName.toLowerCase().includes(q) ||
          user.lastName.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q)
        if (!match) return false
      }
      if (roleFilter && roleFilter !== "all") {
        if (!user.roles.some((r) => r.id === roleFilter)) return false
      }
      return true
    })
  }, [users, searchQuery, roleFilter])

  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.isActive).length
  const adminUsers = users.filter((u) => isUserAdmin(u)).length

  const passwordRulesPassed = useMemo(() => {
    const results: boolean[] = []
    for (const rule of PASSWORD_RULES) {
      results.push(rule.test(formPassword))
    }
    return results
  }, [formPassword])

  const passwordAllPassed = passwordRulesPassed.every(Boolean)
  const passwordsMatch = formPassword === formPasswordConfirm

  const resetPasswordRulesPassed = useMemo(() => {
    const results: boolean[] = []
    for (const rule of PASSWORD_RULES) {
      results.push(rule.test(resetNewPassword))
    }
    return results
  }, [resetNewPassword])

  const resetPasswordAllPassed = resetPasswordRulesPassed.every(Boolean)

  const formValid = useMemo(() => {
    const nameOk =
      formFirstName.trim().length > 0 && formLastName.trim().length > 0
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())
    const rolesOk = selectedRoleIds.size > 0
    if (!editingUserId) {
      return nameOk && emailOk && passwordAllPassed && passwordsMatch && rolesOk
    }
    const user = users.find((u) => u.id === editingUserId)
    if (!user) return false
    const changed =
      formFirstName.trim() !== user.firstName ||
      formLastName.trim() !== user.lastName ||
      formEmail.trim() !== user.email ||
      selectedRoleIds.size !== user.roles.length ||
      !user.roles.every((r) => selectedRoleIds.has(r.id))
    return nameOk && emailOk && rolesOk && changed
  }, [
    formFirstName,
    formLastName,
    formEmail,
    passwordAllPassed,
    passwordsMatch,
    selectedRoleIds,
    editingUserId,
    users,
  ])

  function openCreateSheet() {
    setEditingUserId(null)
    setFormFirstName("")
    setFormLastName("")
    setFormEmail("")
    setFormPassword("")
    setFormPasswordConfirm("")
    setShowPassword(false)
    setSelectedRoleIds(new Set())
    setSaveError(null)
    setSheetOpen(true)
  }

  function openEditSheet(user: UserItem) {
    setEditingUserId(user.id)
    setFormFirstName(user.firstName)
    setFormLastName(user.lastName)
    setFormEmail(user.email)
    setFormPassword("")
    setFormPasswordConfirm("")
    setShowPassword(false)
    setSelectedRoleIds(new Set(user.roles.map((r) => r.id)))
    setSaveError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditingUserId(null)
    setSaveError(null)
  }

  function toggleRole(roleId: string) {
    const hadRole = selectedRoleIds.has(roleId)
    if (hadRole && wouldEditLeaveZeroAdmins(selectedRoleIds, roleId)) {
      setSaveError("Cannot remove the last administrative role")
      return
    }
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  function wouldDeleteLeaveZeroAdmins(user: UserItem): boolean {
    if (!isUserAdmin(user)) return false
    const otherAdmins = users.filter(
      (u) => u.id !== user.id && isUserAdmin(u) && u.isActive,
    )
    return otherAdmins.length === 0
  }

  function wouldEditLeaveZeroAdmins(
    currentRoleIds: Set<string>,
    removingRoleId: string,
  ): boolean {
    if (!editingUserId) return false
    const user = users.find((u) => u.id === editingUserId)
    if (!user) return false
    if (!isUserAdmin(user)) return false

    const removingIsAdmin = adminRoleIds.has(removingRoleId)
    if (!removingIsAdmin) return false

    const remainingAdminIds = [...currentRoleIds]
      .filter((id) => id !== removingRoleId)
      .filter((id) => adminRoleIds.has(id))
    if (remainingAdminIds.length > 0) return false

    const otherAdmins = users.filter(
      (u) => u.id !== editingUserId && isUserAdmin(u) && u.isActive,
    )
    return otherAdmins.length === 0
  }

  async function handleSave() {
    if (!formValid) return

    setSaving(true)
    setSaveError(null)
    try {
      const body: {
        firstName: string; lastName: string; email: string; roleIds: string[]; password?: string;
      } = {
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        email: formEmail.trim(),
        roleIds: Array.from(selectedRoleIds),
      }

      let res: Response
      if (editingUserId) {
        res = await apiClient(`/users/${editingUserId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        body.password = formPassword
        res = await apiClient("/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save user")
      }

      closeSheet()
      fetchData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(user: UserItem) {
    setDeletingUser(user)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deletingUser) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiClient(`/users/${deletingUser.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.code === "LAST_ADMIN") {
          throw new Error(data.error)
        }
        throw new Error(data.error || "Failed to deactivate user")
      }
      setDeletingUser(null)
      fetchData()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to deactivate user",
      )
    } finally {
      setDeleting(false)
    }
  }

  function confirmResetPassword(user: UserItem) {
    setResettingUser(user)
    setResetNewPassword("")
    setShowResetPassword(false)
    setResetError(null)
    setResetSuccess(null)
  }

  async function handleResetPassword() {
    if (!resettingUser) return
    if (!resetPasswordAllPassed) {
      const failed = PASSWORD_RULES.filter((_, i) => !resetPasswordRulesPassed[i]).map((r) => r.label.toLowerCase())
      setResetError(`Password must meet: ${failed.join(", ")}`)
      return
    }
    setResetting(true)
    setResetError(null)
    setResetSuccess(null)
    try {
      const res = await apiClient(
        `/users/${resettingUser.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: resetNewPassword }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to reset password")
      }
      const data = await res.json()
      setResetSuccess(
        typeof data.message === "string"
          ? data.message
          : "Password reset successfully",
      )
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Failed to reset password",
      )
    } finally {
      setResetting(false)
    }
  }

  function confirmDeactivate(user: UserItem) {
    setDeactivatingUser(user)
    setToggleError(null)
  }

  async function performToggleActive(user: UserItem) {
    const targetActive = !user.isActive
    setTogglingActive((prev) => new Set(prev).add(user.id))
    setToggleError(null)
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, isActive: targetActive } : u,
      ),
    )
    try {
      const res = await apiClient(`/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: targetActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update user")
      }
    } catch (err) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isActive: !targetActive } : u,
        ),
      )
      setToggleError(
        err instanceof Error ? err.message : "Failed to update user status",
      )
    } finally {
      setTogglingActive((prev) => {
        const next = new Set(prev)
        next.delete(user.id)
        return next
      })
    }
  }

  async function handleToggleActive(user: UserItem) {
    if (user.isActive) {
      confirmDeactivate(user)
    } else {
      performToggleActive(user)
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingUser) return
    setDeactivating(true)
    await performToggleActive(deactivatingUser)
    setDeactivating(false)
    setDeactivatingUser(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage users and their roles
          </p>
        </div>
        <Button onClick={openCreateSheet}>
          <PlusIcon aria-hidden="true" />
          Create User
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
        <Card className="rounded-none bg-background shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-normal text-muted-foreground text-xs tracking-wide">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-xl tabular-nums">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none bg-background shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-normal text-muted-foreground text-xs tracking-wide">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-xl tabular-nums">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none bg-background shadow-none ring-0">
          <CardHeader>
            <CardTitle className="font-normal text-muted-foreground text-xs tracking-wide">
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-xl tabular-nums">{adminUsers}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setToggleError(null)
            }}
            placeholder="Search by name or email…"
            className="pl-8"
            aria-label="Search users"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <div className="w-full sm:w-[200px]">
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value ?? "all")
              setToggleError(null)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by role">
              <SelectValue placeholder="All roles">
                {roleFilter === "all"
                  ? "All roles"
                  : roles.find((r) => r.id === roleFilter)?.name ?? roleFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {toggleError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-destructive" role="alert">
            {toggleError}
          </p>
          <button
            onClick={() => setToggleError(null)}
            className="text-destructive/60 hover:text-destructive"
            aria-label="Dismiss error"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <UsersIcon
            className="size-10 text-muted-foreground/50"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">No users yet</p>
          <Button variant="outline" onClick={openCreateSheet}>
            <PlusIcon aria-hidden="true" />
            Create your first user
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Name</TableHead>
                <TableHead className="w-[250px]">Email</TableHead>
                <TableHead className="w-[200px]">Roles</TableHead>
                <TableHead className="w-[90px]">Active</TableHead>
                <TableHead className="w-[130px]">Created</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No users match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                const admin = isUserAdmin(user)
                const deleteBlocked = wouldDeleteLeaveZeroAdmins(user)
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${getAvatarColor(user.id)}`}
                          aria-hidden="true"
                        >
                          {getInitials(user.firstName, user.lastName)}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="truncate block max-w-[250px]">
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            No roles
                          </span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant={
                                admin && adminRoleIds.has(role.id)
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {role.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={() => handleToggleActive(user)}
                        disabled={togglingActive.has(user.id)}
                        aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.firstName} ${user.lastName}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditSheet(user)}
                        >
                          <EditIcon aria-hidden="true" />
                          <span className="sr-only">
                            Edit {user.firstName} {user.lastName}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => confirmResetPassword(user)}
                        >
                          <KeyIcon aria-hidden="true" />
                          <span className="sr-only">
                            Reset password for {user.firstName} {user.lastName}
                          </span>
                        </Button>
                        {deleteBlocked ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={<span className="inline-flex" />}
                            >
                              <span tabIndex={0}>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled
                                >
                                  <Trash2Icon aria-hidden="true" />
                                  <span className="sr-only">
                                    Deactivate {user.firstName}{" "}
                                    {user.lastName}
                                  </span>
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Cannot deactivate the last user with
                              administrative privileges
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => confirmDelete(user)}
                          >
                            <Trash2Icon aria-hidden="true" />
                            <span className="sr-only">
                              Deactivate {user.firstName} {user.lastName}
                            </span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingUserId ? "Edit User" : "Create User"}
            </SheetTitle>
            <SheetDescription>
              {editingUserId
                ? "Update the user's details and roles"
                : "Create a new user with a name, email, password, and roles"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 [overscroll-behavior:contain]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-first-name">First name</Label>
              <Input
                id="user-first-name"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                placeholder="e.g. John…"
                autoComplete="off"
                name="user-first-name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="user-last-name">Last name</Label>
              <Input
                id="user-last-name"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                placeholder="e.g. Doe…"
                autoComplete="off"
                name="user-last-name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. john@example.com…"
                autoComplete="off"
                name="user-email"
              />
            </div>

            {!editingUserId && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="user-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Min. 8 characters…"
                      autoComplete="off"
                      name="user-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>
                  {formPassword.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      {PASSWORD_RULES.map((rule, i) => {
                        const passed = passwordRulesPassed[i]
                        return (
                          <div
                            key={rule.label}
                            className={`flex items-center gap-1.5 text-xs ${passed ? "text-green-600" : "text-muted-foreground"}`}
                          >
                            {passed ? (
                              <CheckIcon className="size-3 shrink-0" />
                            ) : (
                              <span className="size-3 shrink-0 rounded-full border border-muted-foreground" />
                            )}
                            {rule.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="user-password-confirm">
                    Confirm password
                  </Label>
                  <Input
                    id="user-password-confirm"
                    type={showPassword ? "text" : "password"}
                    value={formPasswordConfirm}
                    onChange={(e) => setFormPasswordConfirm(e.target.value)}
                    placeholder="Repeat password…"
                    autoComplete="off"
                    name="user-password-confirm"
                  />
                  {formPasswordConfirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <Label>Roles</Label>
              <p className="text-xs text-muted-foreground">
                Select the roles to assign to this user
              </p>
            </div>

            <div className="flex flex-col gap-2 pb-6">
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No roles available. Create roles first.
                </p>
              ) : (
                roles.map((role) => {
                  const locked =
                    !!editingUserId &&
                    selectedRoleIds.has(role.id) &&
                    adminRoleIds.has(role.id) &&
                    wouldEditLeaveZeroAdmins(selectedRoleIds, role.id)
                  return (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedRoleIds.has(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                        disabled={locked}
                      />
                      <span
                        className={
                          locked ? "text-muted-foreground" : undefined
                        }
                      >
                        {role.name}
                      </span>
                      {locked && (
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="inline-flex" />}
                          >
                            <span
                              tabIndex={0}
                              className="inline-flex items-center"
                            >
                              <span className="sr-only">
                                Cannot remove the last administrative role
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Cannot remove the last role with administrative
                            privileges
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <SheetFooter className="border-t px-4 py-4">
            {saveError && (
              <p className="flex-1 text-sm text-destructive" role="alert">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formValid}>
                {saving ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : editingUserId ? (
                  "Save"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-medium text-foreground">
                {deletingUser?.firstName} {deletingUser?.lastName}
              </span>
              ? This will revoke their access and expire their sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <>
                  <Spinner />
                  Deactivating…
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!resettingUser}
        onOpenChange={(open) => {
          if (!open) {
            setResettingUser(null)
            setShowResetPassword(false)
            setResetSuccess(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Set a new password for{" "}
              <span className="font-medium text-foreground">
                {resettingUser?.firstName} {resettingUser?.lastName}
              </span>
              . Their existing sessions will be invalidated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {resetSuccess ? (
            <p className="text-sm text-green-600">{resetSuccess}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Min. 8 characters, upper, lower, number, special…"
                  autoComplete="off"
                  name="reset-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                >
                  {showResetPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {resetNewPassword.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {PASSWORD_RULES.map((rule, i) => {
                    const passed = resetPasswordRulesPassed[i]
                    return (
                      <div
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${passed ? "text-green-600" : "text-muted-foreground"}`}
                      >
                        {passed ? (
                          <CheckIcon className="size-3 shrink-0" />
                        ) : (
                          <span className="size-3 shrink-0 rounded-full border border-muted-foreground" />
                        )}
                        {rule.label}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {resetError && (
            <p className="text-sm text-destructive" role="alert">
              {resetError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {resetSuccess ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!resetSuccess && (
              <AlertDialogAction
                disabled={resetting || !resetPasswordAllPassed}
                onClick={handleResetPassword}
              >
                {resetting ? (
                  <>
                    <Spinner />
                    Resetting…
                  </>
                ) : (
                  "Reset Password"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deactivatingUser}
        onOpenChange={(open) => {
          if (!open) setDeactivatingUser(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-medium text-foreground">
                {deactivatingUser?.firstName} {deactivatingUser?.lastName}
              </span>
              ? This will revoke their access and expire their sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deactivating}
              onClick={handleConfirmDeactivate}
            >
              {deactivating ? (
                <>
                  <Spinner />
                  Deactivating…
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
