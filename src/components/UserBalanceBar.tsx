import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UserBalanceBar = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const navigate = useNavigate();

  const fetchBalance = async (uid: string) => {
    const { data, error } = await supabase
      .from("balances")
      .select("balance_cents")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.warn("[UserBalanceBar] erro ao buscar saldo:", error.message);
      return;
    }

    if (!data) {
      // Cria registro de saldo se não existir (fallback caso trigger não tenha rodado)
      await supabase.from("balances").insert({ user_id: uid, balance_cents: 0 });
      setBalance(0);
      return;
    }

    setBalance((data as any).balance_cents ?? 0);
  };

  useEffect(() => {
    if (!user) return;
    fetchBalance(user.id);

    // Realtime: atualiza saldo quando muda no banco
    const channel = supabase.channel(`balance-${user.id}-${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as any)?.balance_cents;
          if (typeof next === "number") setBalance(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate("/wallet")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
        title="Ir para Carteira"
      >
        <Wallet className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-primary">
          R$ {(balance / 100).toFixed(2).replace(".", ",")}
        </span>
      </button>
      <button
        onClick={() => navigate("/wallet?deposit=1")}
        className="flex items-center gap-1 px-2 py-1.5 bg-accent/40 border border-accent rounded-lg hover:bg-accent/60 transition-colors"
        title="Depositar saldo"
      >
        <Plus className="w-3.5 h-3.5 text-accent-foreground" />
        <span className="text-xs font-semibold text-accent-foreground hidden sm:inline">Depositar</span>
      </button>
    </div>
  );
};

export default UserBalanceBar;
