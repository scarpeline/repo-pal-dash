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
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(!!token);

  useEffect(() => {
    // Check for code in URL after OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeToken(code);
    }
  }, []);

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      getUser(token)
        .then(setUser)
        .catch(() => {
          setToken(null);
          localStorage.removeItem("gh_token");
        })
        .finally(() => setIsLoading(false));
    }
  }, [token]);

  async function exchangeToken(code: string) {
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
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = window.location.origin + "/auth/callback";
    const scope = "repo,user,read:org";
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("gh_token");
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
