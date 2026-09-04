import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getStoredSession, logout as logoutStorage, onSessionInvalidated, type CurrentUser } from "./auth";

type AuthState = {
  user: CurrentUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await getStoredSession();
    setUser(stored?.user ?? null);
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  useEffect(() => onSessionInvalidated(() => setUser(null)), []);

  const signOut = useCallback(async () => {
    await logoutStorage();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
