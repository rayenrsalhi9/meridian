import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { loginRequestSchema } from "shared";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function validateAll(email: string, password: string) {
  const parsed = loginRequestSchema.safeParse({ email, password });
  if (parsed.success) return {};
  return parsed.error.flatten().fieldErrors as {
    email?: string[];
    password?: string[];
  };
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string[];
    password?: string[];
  }>({});
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const allErrors = useMemo(() => validateAll(email, password), [email, password]);
  const isSubmitDisabled =
    isPending || !email || !password || Object.keys(allErrors).length > 0;

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors((prev) => ({ ...prev, [field]: allErrors[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const allTouched = { email: true, password: true };
    setTouched(allTouched);

    const errors = validateAll(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsPending(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password",
      );
    } finally {
      setIsPending(false);
    }
  };

  const emailError = touched.email ? fieldErrors.email : undefined;
  const passwordError = touched.password ? fieldErrors.password : undefined;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-4">
      <Card size="sm" className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex justify-center">
            <img src="/meridian-icon.webp" alt="Meridian" className="size-12" />
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div aria-live="polite" aria-atomic="true" className="text-center">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                onBlur={() => handleBlur("email")}
                required
                autoComplete="email"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              {emailError && (
                <p id="email-error" className="text-xs text-destructive" role="alert">
                  {emailError[0]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onBlur={() => handleBlur("password")}
                required
                autoComplete="current-password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
              />
              {passwordError && (
                <p id="password-error" className="text-xs text-destructive" role="alert">
                  {passwordError[0]}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
