import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

const UserBalanceBar = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("balances")
      .select("balance_cents")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setBalance((data as any).balance_cents);
      });
  }, [user]);

  if (!user || balance === null) return null;

  return (
    <div className="h-7 bg-card border-b border-border flex items-center justify-end px-3 gap-2 text-xs shrink-0">
      <Wallet className="w-3 h-3 text-[hsl(var(--success))]" />
      <span className="text-foreground font-medium">R$ {(balance / 100).toFixed(2)}</span>
    </div>
  );
};

export default UserBalanceBar;
