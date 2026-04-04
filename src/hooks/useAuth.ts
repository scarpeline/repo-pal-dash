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
}

export function useAuth() {
  const ctx = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!ctx.user) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", ctx.user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", ctx.user.id),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as any);
    }
    if (rolesRes.data) {
      setRoles((rolesRes.data as any[]).map((r) => r.role));
    }
    setLoading(false);
  }, [ctx.user]);

  useEffect(() => {
    if (!ctx.isLoading) {
      fetchData();
    }
  }, [ctx.isLoading, ctx.user, fetchData]);

  const isAffiliate = roles.includes("affiliate") || !!profile?.affiliate_code;

  return {
    ...ctx,
    profile,
    roles,
    isAffiliate,
    loading: ctx.isLoading || loading,
    refetchData: fetchData,
    user: ctx.user,
  };
}
