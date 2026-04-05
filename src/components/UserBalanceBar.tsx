import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UserBalanceBar = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();

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
    <button 
      onClick={() => navigate("/wallet")}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors" 
      title="Ir para Carteira"
    >
      <Wallet className="w-4 h-4 text-primary" />
      <span className="text-sm font-bold text-primary">R$ {(balance / 100).toFixed(2)}</span>
    </button>
  );
};

export default UserBalanceBar;
