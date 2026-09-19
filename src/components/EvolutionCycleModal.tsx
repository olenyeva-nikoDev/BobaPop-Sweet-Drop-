import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { BOBA_TIERS } from '../data/bobaTiers';

interface EvolutionCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EvolutionCycleModal: React.FC<EvolutionCycleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[370px] max-h-[85vh] bg-[#FFFDF9] rounded-3xl p-5 shadow-2xl border-2 border-[#FED7AA] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#FDE8D7]">
          <div>
            <h3 className="text-xl font-black text-[#5C3A21] font-['Fredoka']">
              Boba Evolution 🧋
            </h3>
            <p className="text-xs text-[#8A6348]">Gabungkan 2 boba kembar untuk naik level!</p>
          </div>
          <button
            id="close-evolution-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5E6DA] hover:bg-[#EDD4C2] text-[#5C3A21] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable list of Boba tiers */}
        <div className="overflow-y-auto py-3 space-y-2 max-h-[58vh] pr-1">
          {BOBA_TIERS.map((tier, idx) => {
            const next = idx < BOBA_TIERS.length - 1 ? BOBA_TIERS[idx + 1] : null;
            return (
              <div
                key={tier.tier}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#FBE6D5] shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-full shadow-inner flex items-center justify-center shrink-0 border border-black/10"
                    style={{
                      width: `${Math.max(28, Math.min(46, tier.radius * 0.45 + 16))}px`,
                      height: `${Math.max(28, Math.min(46, tier.radius * 0.45 + 16))}px`,
                      background: `radial-gradient(circle at 35% 35%, ${tier.colorLight}, ${tier.color} 70%, ${tier.colorDark})`,
                    }}
                  >
                    <div className="w-1 h-1 rounded-full bg-black/40 mx-0.5" />
                    <div className="w-1 h-1 rounded-full bg-black/40 mx-0.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#5C3A21] flex items-center gap-1">
                      <span>Lv.{tier.tier + 1}</span>
                      <span>{tier.name}</span>
                    </div>
                    <div className="text-[10px] text-[#A87C5E]">+{tier.points} pts</div>
                  </div>
                </div>

                {next ? (
                  <div className="flex items-center text-[#B45309] text-[11px] font-bold gap-1 bg-[#FFF7ED] px-2 py-1 rounded-xl border border-[#FED7AA]">
                    <ArrowRight className="w-3 h-3 text-[#EA580C]" />
                    <span className="text-[10px] text-[#7C2D12]">Lv.{next.tier + 1}</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-400 text-white shadow-xs">
                    MAX 👑
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-xl bg-[#5C3A21] text-white font-bold text-sm hover:bg-[#4A2D17] transition-all cursor-pointer font-['Fredoka']"
        >
          Mengerti, Ayo Main!
        </button>
      </div>
    </div>
  );
};
