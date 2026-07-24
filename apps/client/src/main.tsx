import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedLayout } from "@/components/protected-layout";
import { AdminProtectedLayout } from "@/components/admin-protected-layout";
import App from "@/App";
import LoginPage from "@/pages/login-page";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { NotFoundPage } from "@/pages/not-found-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { AdminRolesPage } from "@/pages/admin-roles-page";
import { AdminUsersPage } from "@/pages/admin-users-page";
import { ProfilePage } from "@/pages/profile-page";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route element={<App />}>
                <Route index element={<DashboardSkeleton />} />
                <Route
                  path="documents"
                  element={<PlaceholderPage title="Documents" />}
                />
                <Route
                  path="chat"
                  element={<PlaceholderPage title="Chat" />}
                />
                <Route
                  path="forums"
                  element={<PlaceholderPage title="Forums" />}
                />
                <Route path="profile" element={<ProfilePage />} />
                <Route element={<AdminProtectedLayout />}>
                  <Route
                    path="admin/users"
                    element={<AdminUsersPage />}
                  />
                  <Route
                    path="admin/roles"
                    element={<AdminRolesPage />}
                  />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
