import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [ghToken, setGhToken] = useState<string | null>(() => localStorage.getItem("gh_token"));

  const syncAuthState = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", nextUser.id)
      .eq("role", "admin");

    setIsAdmin(Boolean(roles?.length));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, [syncAuthState]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setGhToken(null);
    localStorage.removeItem("gh_token");
    localStorage.removeItem("gh_user");
  }, []);

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
