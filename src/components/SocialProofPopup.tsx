import { useState, useEffect } from "react";
import { ShoppingBag, Zap, Wallet, MapPin } from "lucide-react";

interface SocialProof {
  id: number;
  name: string;
  action: string;
  amount: string;
  city: string;
  time: string;
  icon: "purchase" | "recharge" | "package";
}

const socialProofs: SocialProof[] = [
  { id: 1, name: "Rodrigo", action: "recarregou", amount: "R$ 20", city: "São Paulo, SP", time: "há 2 min", icon: "recharge" },
  { id: 2, name: "Márcio", action: "comprou o pacote", amount: "100 Mil Créditos", city: "Curitiba, PR", time: "há 5 min", icon: "package" },
  { id: 3, name: "Ana Paula", action: "recarregou", amount: "R$ 50", city: "Rio de Janeiro, RJ", time: "há 8 min", icon: "recharge" },
  { id: 4, name: "Juliano", action: "comprou o pacote", amount: "500 Mil Créditos", city: "Belo Horizonte, MG", time: "há 12 min", icon: "package" },
  { id: 5, name: "Fernanda", action: "recarregou", amount: "R$ 10", city: "Salvador, BA", time: "há 15 min", icon: "recharge" },
  { id: 6, name: "Ricardo", action: "comprou o pacote", amount: "1 Milhão de Créditos", city: "Florianópolis, SC", time: "há 18 min", icon: "package" },
  { id: 7, name: "Lucas", action: "recarregou", amount: "R$ 30", city: "Fortaleza, CE", time: "há 22 min", icon: "recharge" },
  { id: 8, name: "Patrícia", action: "comprou o pacote", amount: "250 Mil Créditos", city: "Porto Alegre, RS", time: "há 25 min", icon: "package" },
  { id: 9, name: "Gustavo", action: "recarregou", amount: "R$ 100", city: "Brasília, DF", time: "há 30 min", icon: "recharge" },
  { id: 10, name: "Camila", action: "comprou o pacote", amount: "Elite 2 Milhões", city: "Goiânia, GO", time: "há 35 min", icon: "package" },
];

export const SocialProofPopup = () => {
  const [currentIdx, setCurrentIdx] = useState<number>(-1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Timer inicial para aparecer a primeira vez
    const initialTimer = setTimeout(() => {
      showNext();
    }, 5000);

    return () => clearTimeout(initialTimer);
  }, []);

  const showNext = () => {
    setCurrentIdx((prev) => (prev + 1) % socialProofs.length);
    setIsVisible(true);

    // Fica visível por 6 segundos
    setTimeout(() => {
      setIsVisible(false);
      // Espera entre 8 a 15 segundos para mostrar o próximo
      const nextDelay = Math.floor(Math.random() * 7000) + 8000;
      setTimeout(showNext, nextDelay);
    }, 6000);
  };

  if (currentIdx === -1) return null;

  const item = socialProofs[currentIdx];

  const getIcon = () => {
    switch (item.icon) {
      case "recharge": return <Wallet className="w-4 h-4 text-emerald-400" />;
      case "package": return <Zap className="w-4 h-4 text-amber-400" />;
      default: return <ShoppingBag className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div 
      className={`fixed bottom-20 left-4 md:bottom-6 md:left-6 z-[100] transition-all duration-500 transform ${
        isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-10 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl flex items-center gap-4 max-w-[280px]">
        <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
          item.icon === 'recharge' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
        }`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white leading-tight">
            <span className="font-bold">{item.name}</span> {item.action} <span className="font-bold text-primary">{item.amount}</span>
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {item.city}
            </div>
            <span className="text-[9px] text-slate-500 shrink-0">{item.time}</span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-[10px]">×</span>
        </button>
      </div>
      
      {/* Som de notificação sutil (opcional, aqui apenas animação visual) */}
      <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full animate-ping" />
    </div>
  );
};

export default SocialProofPopup;
