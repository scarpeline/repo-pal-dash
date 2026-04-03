import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getUser, type GitHubUser } from "@/lib/github";

interface AuthContextType {
  token: string | null;
  user: GitHubUser | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("gh_token"));
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const cached = localStorage.getItem("gh_user");
    return cached ? JSON.parse(cached) : null;
  });
  const [isLoading, setIsLoading] = useState(!!token && !user);

  useEffect(() => {
    if (token && !user) {
      setIsLoading(true);
      getUser(token)
        .then((u) => {
          setUser(u);
          localStorage.setItem("gh_user", JSON.stringify(u));
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem("gh_token");
          localStorage.removeItem("gh_user");
        })
        .finally(() => setIsLoading(false));
    }
  }, [token]);

  const login = useCallback(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = encodeURIComponent(window.location.origin + "/auth/callback");
    window.location.href = `${supabaseUrl}/functions/v1/github-oauth?action=login&redirect_uri=${redirectUri}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("gh_token");
    localStorage.removeItem("gh_user");
  }, []);

  const handleTokenExchange = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/github-oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        localStorage.setItem("gh_token", data.access_token);
        if (data.user) {
          const ghUser: GitHubUser = {
            login: data.user.login,
            avatar_url: data.user.avatar_url,
            name: data.user.name,
            bio: null,
            public_repos: 0,
          };
          setUser(ghUser);
          localStorage.setItem("gh_user", JSON.stringify(ghUser));
        }
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      <AuthExchangeHandler onExchange={handleTokenExchange} />
      {children}
    </AuthContext.Provider>
  );
}

function AuthExchangeHandler({ onExchange }: { onExchange: (code: string) => Promise<void> }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      onExchange(code);
    }
  }, []);
  return null;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
