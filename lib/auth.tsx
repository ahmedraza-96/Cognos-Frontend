"use client";

// Client-side auth context: holds the JWT (localStorage) and current user.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, clearToken, getToken, setToken } from "./api";

export interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const authenticate = useCallback(
    async (path: "/auth/login" | "/auth/signup", email: string, password: string) => {
      const { access_token } = await apiFetch<{ access_token: string }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(access_token);
      await loadUser();
    },
    [loadUser],
  );

  const value: AuthContextValue = {
    user,
    loading,
    login: (email, password) => authenticate("/auth/login", email, password),
    signup: (email, password) => authenticate("/auth/signup", email, password),
    logout: () => {
      clearToken();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
