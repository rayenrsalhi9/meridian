import { Outlet } from "react-router";

export function AdminProtectedLayout() {
  // TODO(M5): Check user claims (USER_MANAGE, ROLE_MANAGE) once
  // claims are available on the client via AuthContext.
  return <Outlet />;
}
