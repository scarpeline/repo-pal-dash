import { useAuth as useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  affiliate_code: string | null;
  referral_code: string | null;
  referred_by: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
}

interface Balance {
  balance_cents: number;
  total_deposited_cents: number;
  total_spent_cents: number;
}

export function useAuth() {
  const ctx = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!ctx.user) {
      setProfile(null);
      setBalance(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    const [profileRes, balanceRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", ctx.user.id).single(),
      supabase.from("balances").select("*").eq("user_id", ctx.user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", ctx.user.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data as any);
    if (balanceRes.data) setBalance(balanceRes.data as any);
    if (rolesRes.data) setRoles((rolesRes.data as any[]).map((r) => r.role));
    setLoading(false);
  }, [ctx.user]);

  useEffect(() => {
    if (!ctx.isLoading) {
      fetchData();
    }
  }, [ctx.isLoading, ctx.user, fetchData]);

  // Admin check: either from roles table OR from email-based check in context
  const isAdmin = ctx.isAdmin || roles.includes("admin");
  const isAffiliate = roles.includes("affiliate") || !!profile?.affiliate_code;

  return {
    ...ctx,
    profile,
    balance,
    roles,
    isAdmin,
    isAffiliate,
    loading: ctx.isLoading || loading,
    refetchData: fetchData,
    user: ctx.user,
    signOut: ctx.logout,
  };
}
