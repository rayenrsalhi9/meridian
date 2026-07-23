import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, useAnimate, AnimatePresence } from "motion/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
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
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [scope, animate] = useAnimate();

  const allErrors = useMemo(() => validateAll(email, password), [email, password]);
  const isSubmitDisabled = isPending || Object.keys(allErrors).length > 0;

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const allTouched = { email: true, password: true };
    setTouched(allTouched);

    const errors = validateAll(email, password);
    if (Object.keys(errors).length > 0) {
      void animate(scope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.3 });
      return;
    }

    setIsPending(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password",
      );
      void animate(scope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.3 });
    } finally {
      setIsPending(false);
    }
  };

  const emailError = touched.email ? allErrors.email : undefined;
  const passwordError = touched.password ? allErrors.password : undefined;

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
          <form
            ref={scope}
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4"
          >
            <div aria-live="polite" aria-atomic="true" className="text-center">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    key={error}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
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
              <AnimatePresence mode="wait">
                {emailError && (
                  <motion.p
                    id="email-error"
                    key={emailError[0]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {emailError[0]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
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
              <AnimatePresence mode="wait">
                {passwordError && (
                  <motion.p
                    id="password-error"
                    key={passwordError[0]}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {passwordError[0]}
                  </motion.p>
                )}
              </AnimatePresence>
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
