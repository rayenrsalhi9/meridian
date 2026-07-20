import { Navigate, Outlet } from "react-router";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";

export function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
