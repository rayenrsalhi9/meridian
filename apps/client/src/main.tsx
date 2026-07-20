import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedLayout } from "@/components/protected-layout";
import App from "./App.tsx";
import LoginPage from "./pages/login-page.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route element={<App />}>
              {/*
               * Authenticated routes go here.
               * Future: <Route element={<AdminProtectedLayout />}>
               *   Admin screens (Users, Roles) nest here.
               */}
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
