import { useState, useMemo, useEffect, useCallback } from "react";
import { Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { updateProfileSchema, changePasswordRequestSchema } from "shared";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { PASSWORD_RULES } from "shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";

export function ProfilePage() {
  const { user, profile, refetchProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileTouched, setProfileTouched] = useState({ firstName: false, lastName: false });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
    }
  }, [profile]);

  const profileErrors = useMemo(() => {
    if (!firstName && !lastName) return {};
    const parsed = updateProfileSchema.safeParse({ firstName, lastName });
    if (parsed.success) return {};
    return parsed.error.flatten().fieldErrors as {
      firstName?: string[];
      lastName?: string[];
    };
  }, [firstName, lastName]);

  const passwordValidation = useMemo(() => {
    if (!currentPassword && !newPassword && !confirmPassword) return null;
    const parsed = changePasswordRequestSchema.safeParse({
      currentPassword,
      newPassword,
    });
    const passwordErrors = parsed.success
      ? {}
      : (parsed.error.flatten().fieldErrors as {
          currentPassword?: string[];
          newPassword?: string[];
        });
    const confirmError =
      confirmPassword.length > 0 && newPassword !== confirmPassword
        ? ["Passwords do not match"]
        : undefined;
    return { passwordErrors, confirmError };
  }, [currentPassword, newPassword, confirmPassword]);

  const passwordRulesPassed = useMemo(() => {
    return PASSWORD_RULES.map((rule) => rule.test(newPassword));
  }, [newPassword]);

  const profileFormValid = useMemo(() => {
    const nameFilled = firstName.trim().length > 0 && lastName.trim().length > 0;
    const noErrors = Object.keys(profileErrors).length === 0;
    const changed =
      firstName.trim() !== (profile?.firstName ?? "") ||
      lastName.trim() !== (profile?.lastName ?? "");
    return nameFilled && noErrors && changed;
  }, [firstName, lastName, profileErrors, profile]);

  const passwordFormValid = useMemo(() => {
    if (!currentPassword || !newPassword || !confirmPassword) return false;
    if (!passwordRulesPassed.every(Boolean)) return false;
    if (newPassword !== confirmPassword) return false;
    if (
      !passwordValidation ||
      Object.keys(passwordValidation.passwordErrors).length > 0
    ) {
      return false;
    }
    return true;
  }, [
    currentPassword,
    newPassword,
    confirmPassword,
    passwordRulesPassed,
    passwordValidation,
  ]);

  const handleProfileBlur = (field: "firstName" | "lastName") => {
    setProfileTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePasswordBlur = (field: "currentPassword" | "newPassword" | "confirmPassword") => {
    setPasswordTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleProfileSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);

    if (!profileFormValid) return;

    setProfileSaving(true);
    try {
      const res = await apiClient("/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileSuccess(true);
      await refetchProfile();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }, [firstName, lastName, profileFormValid, refetchProfile]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (!passwordFormValid) return;

    if (!user) {
      setPasswordError("Not authenticated");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await apiClient(`/users/${user.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTouched({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }, [currentPassword, newPassword, passwordFormValid, user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const firstNameError = profileTouched.firstName ? profileErrors.firstName : undefined;
  const lastNameError = profileTouched.lastName ? profileErrors.lastName : undefined;

  const displayedNewPasswordError =
    passwordTouched.newPassword
      ? passwordValidation?.passwordErrors?.newPassword
      : undefined;
  const displayedConfirmError =
    passwordTouched.confirmPassword
      ? passwordValidation?.confirmError
      : undefined;
  const displayedCurrentPasswordError =
    passwordTouched.currentPassword
      ? passwordValidation?.passwordErrors?.currentPassword
      : undefined;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Profile
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
              <div className="flex flex-col items-center gap-3">
                {profile && (
                  <>
                    <UserAvatar profile={profile} userId={user.id} size="lg" />
                    <p className="text-sm font-medium text-center">
                      {profile.firstName} {profile.lastName}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-first-name">First Name</Label>
                  <Input
                    id="profile-first-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setProfileError("");
                      setProfileSuccess(false);
                    }}
                    onBlur={() => handleProfileBlur("firstName")}
                    aria-invalid={!!firstNameError}
                    aria-describedby={firstNameError ? "first-name-error" : undefined}
                  />
                  <AnimatePresence mode="wait">
                    {firstNameError && (
                      <motion.p
                        id="first-name-error"
                        key={firstNameError[0]}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs text-destructive"
                        role="alert"
                      >
                        {firstNameError[0]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-last-name">Last Name</Label>
                  <Input
                    id="profile-last-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setProfileError("");
                      setProfileSuccess(false);
                    }}
                    onBlur={() => handleProfileBlur("lastName")}
                    aria-invalid={!!lastNameError}
                    aria-describedby={lastNameError ? "last-name-error" : undefined}
                  />
                  <AnimatePresence mode="wait">
                    {lastNameError && (
                      <motion.p
                        id="last-name-error"
                        key={lastNameError[0]}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs text-destructive"
                        role="alert"
                      >
                        {lastNameError[0]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profile?.email ?? ""}
                    disabled
                    className="text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={profileSaving || !profileFormValid}>
                    {profileSaving ? "Saving..." : "Save"}
                  </Button>
                  <AnimatePresence mode="wait">
                    {profileSuccess && (
                      <motion.p
                        key="profile-success"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs text-green-600"
                        role="status"
                      >
                        Profile updated
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {profileError && (
                      <motion.p
                        key={profileError}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs text-destructive"
                        role="alert"
                      >
                        {profileError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setPasswordError("");
                    setPasswordSuccess(false);
                  }}
                  onBlur={() => handlePasswordBlur("currentPassword")}
                  autoComplete="current-password"
                  aria-invalid={!!displayedCurrentPasswordError}
                  aria-describedby={displayedCurrentPasswordError ? "current-password-error" : undefined}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {displayedCurrentPasswordError && (
                  <motion.p
                    id="current-password-error"
                    key={displayedCurrentPasswordError[0]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {displayedCurrentPasswordError[0]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                    setPasswordSuccess(false);
                  }}
                  onBlur={() => handlePasswordBlur("newPassword")}
                  autoComplete="new-password"
                  aria-invalid={!!displayedNewPasswordError}
                  aria-describedby={displayedNewPasswordError ? "new-password-error" : undefined}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
              </div>
              {newPassword.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {PASSWORD_RULES.map((rule, i) => {
                    const passed = passwordRulesPassed[i];
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
                    );
                  })}
                </div>
              )}
              <AnimatePresence mode="wait">
                {displayedNewPasswordError && (
                  <motion.p
                    id="new-password-error"
                    key={displayedNewPasswordError[0]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {displayedNewPasswordError[0]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                    setPasswordSuccess(false);
                  }}
                  onBlur={() => handlePasswordBlur("confirmPassword")}
                  autoComplete="new-password"
                  aria-invalid={!!displayedConfirmError}
                  aria-describedby={displayedConfirmError ? "confirm-password-error" : undefined}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {displayedConfirmError && (
                  <motion.p
                    id="confirm-password-error"
                    key={displayedConfirmError[0]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {displayedConfirmError[0]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={passwordSaving || !passwordFormValid}>
                {passwordSaving ? "Changing password..." : "Change Password"}
              </Button>
              <AnimatePresence mode="wait">
                {passwordSuccess && (
                  <motion.p
                    key="password-success"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-green-600"
                    role="status"
                  >
                    Password changed successfully
                  </motion.p>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {passwordError && (
                  <motion.p
                    key={passwordError}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {passwordError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
