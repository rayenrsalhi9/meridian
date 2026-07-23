import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { EditIcon, PlusIcon, ShieldIcon, Trash2Icon } from "lucide-react"
import {
  CLAIM_DEFINITIONS,
  getClaimLabel,
  ADMIN_CLAIM_KEYS_SET,
  type ClaimCategory,
} from "shared"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

import { formatDate } from "@/lib/user-utils"
const ADMIN_CLAIM_KEYS = ADMIN_CLAIM_KEYS_SET

interface ClaimItem {
  id: string
  key: string
}

interface RoleListItem {
  id: string
  name: string
  description: string | null
  createdAt: string
  claims: string[]
  userCount: number
}

const CATEGORY_ORDER: ClaimCategory[] = [
  "Documents",
  "Forums",
  "Chat",
  "Users",
  "Roles",
  "Dashboard",
]

function groupClaimsByCategory(
  claims: ClaimItem[],
): Map<ClaimCategory, ClaimItem[]> {
  const groups = new Map<ClaimCategory, ClaimItem[]>()
  for (const category of CATEGORY_ORDER) {
    groups.set(category, [])
  }
  for (const claim of claims) {
    const def = CLAIM_DEFINITIONS[claim.key]
    if (def) {
      const group = groups.get(def.category)
      if (group) group.push(claim)
    }
  }
  for (const category of CATEGORY_ORDER) {
    const group = groups.get(category)
    if (group) group.sort((a, b) => a.key.localeCompare(b.key))
  }
  return groups
}

export function AdminRolesPage() {
  const navigate = useNavigate()

  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [claims, setClaims] = useState<ClaimItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(
    new Set(),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [deletingRole, setDeletingRole] = useState<RoleListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rolesRes, claimsRes] = await Promise.all([
        apiClient("/roles"),
        apiClient("/claims"),
      ])
      if (!rolesRes.ok) {
        if (rolesRes.status === 403) {
          navigate("/login", { replace: true })
          return
        }
        throw new Error(`Failed to fetch roles: ${rolesRes.statusText}`)
      }
      if (!claimsRes.ok) {
        throw new Error(`Failed to fetch claims: ${claimsRes.statusText}`)
      }
      const rolesData: RoleListItem[] = await rolesRes.json()
      const claimsData: ClaimItem[] = await claimsRes.json()
      setRoles(rolesData)
      setClaims(claimsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const claimKeyToId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const claim of claims) {
      map[claim.key] = claim.id
    }
    return map
  }, [claims])

  const claimGroups = useMemo(
    () => groupClaimsByCategory(claims),
    [claims],
  )

  function openCreateSheet() {
    setEditingRoleId(null)
    setRoleName("")
    setRoleDescription("")
    setSelectedClaimIds(new Set())
    setSaveError(null)
    setSheetOpen(true)
  }

  function openEditSheet(role: RoleListItem) {
    setEditingRoleId(role.id)
    setRoleName(role.name)
    setRoleDescription(role.description ?? "")
    const ids = new Set<string>()
    for (const key of role.claims) {
      const id = claimKeyToId[key]
      if (id) ids.add(id)
    }
    setSelectedClaimIds(ids)
    setSaveError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditingRoleId(null)
    setSaveError(null)
  }

  const roleFormValid = useMemo(() => {
    const nameOk = roleName.trim().length > 0
    const claimsOk = selectedClaimIds.size > 0
    if (!editingRoleId) return nameOk && claimsOk
    const role = roles.find((r) => r.id === editingRoleId)
    if (!role) return false
    const changed =
      roleName.trim() !== role.name ||
      roleDescription.trim() !== (role.description ?? "") ||
      selectedClaimIds.size !== role.claims.length ||
      !role.claims.every((key) => selectedClaimIds.has(claimKeyToId[key]))
    return nameOk && claimsOk && changed
  }, [roleName, roleDescription, selectedClaimIds, editingRoleId, roles, claimKeyToId])

  function toggleClaim(claimId: string) {
    const hadClaim = selectedClaimIds.has(claimId)
    if (hadClaim) {
      const next = new Set(selectedClaimIds)
      next.delete(claimId)
      if (wouldEditLeaveZeroAdmins(next)) {
        setSaveError("Cannot remove the last administrative claim")
        return
      }
    }
    setSelectedClaimIds((prev) => {
      const next = new Set(prev)
      if (next.has(claimId)) {
        next.delete(claimId)
      } else {
        next.add(claimId)
      }
      return next
    })
  }

  function toggleCategory(category: ClaimCategory, checked: boolean) {
    const group = claimGroups.get(category)
    if (!group) return
    if (!checked) {
      const next = new Set(selectedClaimIds)
      for (const claim of group) {
        next.delete(claim.id)
      }
      if (wouldEditLeaveZeroAdmins(next)) {
        setSaveError("Cannot remove the last administrative claim")
        return
      }
    }
    setSelectedClaimIds((prev) => {
      const next = new Set(prev)
      for (const claim of group) {
        if (checked) {
          next.add(claim.id)
        } else {
          next.delete(claim.id)
        }
      }
      return next
    })
  }

  function getCategoryState(category: ClaimCategory): {
    checked: boolean
    indeterminate: boolean
  } {
    const group = claimGroups.get(category)
    if (!group || group.length === 0) {
      return { checked: false, indeterminate: false }
    }
    const selectedCount = group.filter((c) => selectedClaimIds.has(c.id)).length
    return {
      checked: selectedCount === group.length,
      indeterminate: selectedCount > 0 && selectedCount < group.length,
    }
  }

  async function handleSave() {
    if (!roleName.trim()) {
      setSaveError("Role name is required")
      return
    }
    if (selectedClaimIds.size === 0) {
      setSaveError("At least one claim must be selected")
      return
    }
    if (wouldEditLeaveZeroAdmins(selectedClaimIds)) {
      setSaveError("Cannot remove the last administrative claim")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        name: roleName.trim(),
        claimIds: Array.from(selectedClaimIds),
      }
      if (roleDescription.trim()) {
        body.description = roleDescription.trim()
      }
      const res = editingRoleId
        ? await apiClient(`/roles/${editingRoleId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await apiClient("/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save role")
      }
      closeSheet()
      fetchData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save role")
    } finally {
      setSaving(false)
    }
  }

  function isAdminRole(role: RoleListItem): boolean {
    return role.claims.some((key) => ADMIN_CLAIM_KEYS.has(key))
  }

  function wouldLeaveZeroAdmins(role: RoleListItem): boolean {
    if (!isAdminRole(role)) return false
    if (role.userCount === 0) return false
    const otherAdminRoles = roles.filter(
      (r) => r.id !== role.id && isAdminRole(r) && r.userCount > 0,
    )
    return otherAdminRoles.length === 0
  }

  function wouldEditLeaveZeroAdmins(proposedIds: Set<string>): boolean {
    if (!editingRoleId) return false
    const role = roles.find((r) => r.id === editingRoleId)
    if (!role) return false
    if (role.userCount === 0) return false
    if (!isAdminRole(role)) return false

    const adminClaimIds = new Set(
      [...ADMIN_CLAIM_KEYS]
        .map((key) => claimKeyToId[key])
        .filter(Boolean),
    )
    const hasAdminClaim = [...proposedIds].some((id) => adminClaimIds.has(id))
    if (hasAdminClaim) return false

    const otherAdminRoles = roles.filter(
      (r) => r.id !== editingRoleId && isAdminRole(r) && r.userCount > 0,
    )
    return otherAdminRoles.length === 0
  }

  function confirmDelete(role: RoleListItem) {
    setDeletingRole(role)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deletingRole) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiClient(`/roles/${deletingRole.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete role")
      }
      setDeletingRole(null)
      fetchData()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete role",
      )
    } finally {
      setDeleting(false)
    }
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
            Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage roles and their permissions
          </p>
        </div>
        <Button onClick={openCreateSheet}>
          <PlusIcon aria-hidden="true" />
          Create Role
        </Button>
      </div>

      <Separator />

      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <ShieldIcon className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No roles yet</p>
          <Button variant="outline" onClick={openCreateSheet}>
            <PlusIcon aria-hidden="true" />
            Create your first role
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[280px]">Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[130px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const adminRole = isAdminRole(role)
              const blocked = wouldLeaveZeroAdmins(role)
              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{role.name}</span>
                      {adminRole && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[280px]">
                    <span className="block truncate">
                      {role.description || <span className="italic">No description</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground tabular-nums">
                      {role.userCount} {role.userCount === 1 ? "member" : "members"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDate(role.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditSheet(role)}
                      >
                        <EditIcon aria-hidden="true" />
                        <span className="sr-only">Edit {role.name}</span>
                      </Button>
                      {blocked ? (
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
                                  Delete {role.name}
                                </span>
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Cannot delete the last role with administrative
                            privileges
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => confirmDelete(role)}
                        >
                          <Trash2Icon aria-hidden="true" />
                          <span className="sr-only">
                            Delete {role.name}
                          </span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent
          side="right"
          className="sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>
              {editingRoleId ? "Edit Role" : "Create Role"}
            </SheetTitle>
            <SheetDescription>
              {editingRoleId
                ? "Update the role name and claims"
                : "Define a new role with a name and claims"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 [overscroll-behavior:contain]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Editor…"
                autoComplete="off"
                name="role-name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role-description">Description</Label>
              <textarea
                id="role-description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Optional description…"
                name="role-description"
                rows={3}
                className="flex min-h-0 w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-hidden placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label>Claims</Label>
              <p className="text-xs text-muted-foreground">
                Select the permissions this role grants
              </p>
            </div>

            <div className="flex flex-col gap-4 pb-6">
              {CATEGORY_ORDER.map((category) => {
                const group = claimGroups.get(category)
                if (!group || group.length === 0) return null
                const { checked, indeterminate } =
                  getCategoryState(category)
                return (
                  <Card key={category} size="sm">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          indeterminate={indeterminate}
                          onCheckedChange={(_checked) =>
                            toggleCategory(category, _checked)
                          }
                          id={`category-${category}`}
                          render={<button />}
                          nativeButton
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="font-heading text-base leading-normal font-medium"
                        >
                          {category}
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2">
                        {group.map((claim) => (
                          <label
                            key={claim.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={selectedClaimIds.has(claim.id)}
                              onCheckedChange={() => toggleClaim(claim.id)}
                            />
                            <span>{getClaimLabel(claim.key)}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <SheetFooter className="border-t px-4 py-4">
            {saveError && (
              <p className="flex-1 text-sm text-destructive" role="alert">{saveError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !roleFormValid}>
                {saving ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : editingRoleId ? (
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
        open={!!deletingRole}
        onOpenChange={(open) => {
          if (!open) setDeletingRole(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingRole?.name}
              </span>
              ? This action cannot be undone.{" "}
              {deletingRole && deletingRole.userCount > 0 && (
                <>
                  <br />
                  <br />
                  {deletingRole.userCount}{" "}
                  {deletingRole.userCount === 1 ? "member" : "members"}{" "}
                  assigned to this role will lose its permissions.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">{deleteError}</p>
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
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
