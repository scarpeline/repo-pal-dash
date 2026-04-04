import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const SUPER_ADMIN_EMAILS = [
  "escarpelineparticular@gmail.com",
  "empresasescarpeline@gmail.com",
];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  ghToken: string | null;
  setGhToken: (t: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ghToken, setGhToken] = useState<string | null>(() => localStorage.getItem("gh_token"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setGhToken(null);
    localStorage.removeItem("gh_token");
    localStorage.removeItem("gh_user");
  }, []);

  const isAdmin = SUPER_ADMIN_EMAILS.includes(user?.email || "");

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, ghToken, setGhToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const SUPER_ADMIN_EMAILS_CONST = SUPER_ADMIN_EMAILS;
