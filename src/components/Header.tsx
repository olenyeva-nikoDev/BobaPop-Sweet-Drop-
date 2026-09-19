import React from 'react';
import { Volume2, VolumeX, RotateCcw, HelpCircle, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BobaTier } from '../types';
import { soundManager } from '../utils/sound';

interface HeaderProps {
  score: number;
  bestScore: number;
  nextTier: BobaTier;
  isMuted: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  onOpenEvolution: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  score,
  bestScore,
  nextTier,
  isMuted,
  onToggleMute,
  onRestart,
  onOpenEvolution,
}) => {
  return (
    <header className="w-full px-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 z-20 flex flex-col gap-2 shrink-0 select-none">
      {/* Top row: Title, Controls, Next Boba */}
      <div className="flex items-center justify-between">
        {/* Title */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="text-2xl font-black tracking-tight text-[#5c3a21] drop-shadow-sm font-['Fredoka']">
              BobaPop!
            </span>
            <span className="text-lg animate-bounce inline-block ml-0.5">✨</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-[#fde8d7] text-[#9a5b32] border border-[#fbd3b6]">
            Sweet Drop
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="evolution-guide-btn"
            onClick={onOpenEvolution}
            title="Lihat Urutan Boba"
            aria-label="Urutan Boba"
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm border border-[#fae2d0] text-[#845330] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <motion.button
            id="sound-toggle-btn"
            onClick={() => {
              soundManager.unlockAudio();
              onToggleMute();
            }}
            onPointerDown={() => soundManager.unlockAudio()}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
            aria-label="Pengaturan Suara"
            className={`w-8 h-8 rounded-full shadow-sm border flex items-center justify-center transition-colors cursor-pointer relative ${
              isMuted
                ? 'bg-[#fdf2e9] border-[#fae2d0] text-[#a88266]'
                : 'bg-white hover:bg-[#fff9f4] border-[#fed7aa] text-[#ea580c] shadow-[0_2px_8px_rgba(234,88,12,0.16)]'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMuted ? (
                <motion.div
                  key="muted"
                  initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.5, rotate: 25, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <VolumeX className="w-4 h-4 text-[#a88266]" />
                </motion.div>
              ) : (
                <motion.div
                  key="unmuted"
                  initial={{ scale: 0.5, rotate: 25, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.5, rotate: -25, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="relative"
                >
                  <Volume2 className="w-4 h-4 text-[#ea580c]" />
                  {/* Subtle active sound wave dot */}
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#22c55e] border border-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <button
            id="restart-game-btn"
            onClick={onRestart}
            title="Mulai Ulang Game"
            aria-label="Mulai Ulang"
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm border border-[#fae2d0] text-[#845330] flex items-center justify-center transition-transform active:scale-95 cursor-pointer hover:rotate-45"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle row: Score Pill, Best Score Pill, and Next Boba preview */}
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Current Score Pill */}
        <div className="col-span-5 bg-gradient-to-br from-white via-[#fffdfa] to-[#fff3e8] border border-[#fae3d2] shadow-[0_4px_12px_rgba(234,179,136,0.22)] rounded-2xl px-3 py-1.5 flex flex-col justify-center">
          <span className="text-[10px] font-bold tracking-wider uppercase text-[#a87c5e]">
            Score
          </span>
          <span className="text-xl font-black text-[#5a381f] leading-tight font-['Fredoka']">
            {score.toLocaleString()}
          </span>
        </div>

        {/* Best Score Pill */}
        <div className="col-span-4 bg-gradient-to-br from-[#fff7ed] to-[#fef2e2] border border-[#fed7aa] shadow-[0_4px_12px_rgba(251,146,60,0.15)] rounded-2xl px-2.5 py-1.5 flex flex-col justify-center">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#b45309]">
              Best
            </span>
          </div>
          <span className="text-lg font-black text-[#854d0e] leading-tight font-['Fredoka']">
            {bestScore.toLocaleString()}
          </span>
        </div>

        {/* Next Boba Preview Badge */}
        <div 
          id="next-boba-badge"
          className="col-span-3 bg-gradient-to-b from-white/95 to-[#fff8f2] border border-[#f5dfce] shadow-[0_2px_8px_rgba(234,179,136,0.18)] rounded-2xl py-1 px-1.5 flex flex-col items-center justify-center transition-all"
          title={`Next: ${nextTier.name} (Tier ${nextTier.tier + 1})`}
        >
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#a87c5e] leading-none mb-1">
            Next
          </span>
          <div className="relative flex items-center justify-center">
            {/* Cute circular Next: [Mini Boba] badge */}
            <div
              className="w-7 h-7 rounded-full shadow-md flex items-center justify-center relative border-2 border-white transition-all duration-300 transform hover:scale-105"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${nextTier.colorLight}, ${nextTier.color} 70%, ${nextTier.colorDark})`,
              }}
            >
              {/* Cute shine arc */}
              <div className="absolute top-0.5 left-1 w-2.5 h-1.5 bg-white/70 rounded-full blur-[0.3px] -rotate-12 pointer-events-none" />

              {/* Tiny kawaii eyes & blush */}
              <div className="flex flex-col items-center z-10">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-[#1e1008] relative">
                    <div className="absolute -top-[1px] -right-[1px] w-[2px] h-[2px] rounded-full bg-white" />
                  </div>
                  <div className="w-1 h-1 rounded-full bg-[#1e1008] relative">
                    <div className="absolute -top-[1px] -right-[1px] w-[2px] h-[2px] rounded-full bg-white" />
                  </div>
                </div>
                {/* Cheerful mouth and rosy blush */}
                <div className="flex items-center justify-between w-4 -mt-0.5">
                  <div className="w-1 h-0.5 rounded-full bg-[#fda4af]" />
                  <div className="w-1 h-0.5 border-b border-[#1e1008] rounded-full" />
                  <div className="w-1 h-0.5 rounded-full bg-[#fda4af]" />
                </div>
              </div>
            </div>
          </div>
          <span className="text-[8px] font-bold text-[#7c4d2d] truncate max-w-[64px] text-center mt-0.5 leading-none">
            {nextTier.name.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  );
};
