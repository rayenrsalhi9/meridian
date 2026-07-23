/* eslint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router";
import { setAccessToken, decodeJwtPayload, apiClient } from "@/lib/api-client";

const API_BASE = "/api/v1";

export interface AuthUser {
  id: string;
  roleIds: string[];
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const res = await apiClient("/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (refreshAttempted.current) return;
    refreshAttempted.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          const decoded = decodeJwtPayload(data.accessToken);
          if (decoded) {
            setAccessToken(data.accessToken);
            setUser({ id: decoded.sub, roleIds: decoded.roles });
            const p = await fetchProfile();
            if (p) setProfile(p);
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false);
      }
    })();

    const onSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
      setProfile(null);
      navigate("/login", { replace: true });
    };

    window.addEventListener("session-expired", onSessionExpired);
    return () => window.removeEventListener("session-expired", onSessionExpired);
  }, [navigate]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!res.ok) {
      const body = await res
        .json()
        .catch(() => ({ error: "Invalid credentials" }));
      throw new Error(body.error || "Invalid credentials");
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    const p = await fetchProfile();
    if (p) setProfile(p);
  }, []);

  const refetchProfile = useCallback(async () => {
    const p = await fetchProfile();
    if (p) setProfile(p);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      console.warn("Logout request failed — clearing session locally");
    }
    setAccessToken(null);
    setUser(null);
    setProfile(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, login, logout, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
