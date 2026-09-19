import React, { useState } from 'react';
import { RotateCcw, Trophy, Award, Sparkles, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BobaTier } from '../types';

interface GameOverModalProps {
  score: number;
  bestScore: number;
  highestTierReached: BobaTier;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  bestScore,
  highestTierReached,
  onRestart,
}) => {
  const isNewBest = score >= bestScore && score > 0;
  const [showCopyToast, setShowCopyToast] = useState<boolean>(false);

  const handleShare = async () => {
    const shareText = `Aku berhasil dapat skor ${score.toLocaleString()} di BobaPop: Sweet Drop! Bisa kalahin rekor bobaku? 😉`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BobaPop: Sweet Drop 🧋',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // If user canceled share or share API failed, fallback to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: Copy link and share text to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = `${shareText}\n${shareUrl}`;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2400);
    } catch {
      // Toast fallback anyway
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2400);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Toast Notification */}
      <AnimatePresence>
        {showCopyToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute top-8 z-50 px-4 py-2 bg-[#5C3A21] text-white rounded-full text-xs font-bold shadow-xl flex items-center gap-2 border border-[#FED7AA]/40"
          >
            <Check className="w-4 h-4 text-[#86EFAC]" />
            Link & skor berhasil disalin! ✨
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="w-full max-w-[340px] bg-white/95 backdrop-blur-xl rounded-[32px] p-5 shadow-[0_16px_40px_rgba(92,58,33,0.22)] border-2 border-[#FED7AA] flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Soft decorative corner ambient glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#fcd34d]/25 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-[#f472b6]/20 rounded-full blur-xl pointer-events-none" />

        {/* Mascot Avatar of highest tier achieved */}
        <div className="relative mb-2 mt-0.5">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-18 h-18 rounded-full shadow-md flex items-center justify-center border-4 border-white relative overflow-hidden"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${highestTierReached.colorLight}, ${highestTierReached.color} 70%, ${highestTierReached.colorDark})`,
            }}
          >
            {/* Cute gloss shine */}
            <div className="absolute top-1.5 left-2.5 w-6 h-3.5 bg-white/60 rounded-full blur-[0.6px] -rotate-12 pointer-events-none" />

            {/* Kawaii Face */}
            <div className="flex flex-col items-center z-10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1e1008] relative">
                  <div className="w-1 h-1 rounded-full bg-white absolute top-0.5 right-0.5" />
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#1e1008] relative">
                  <div className="w-1 h-1 rounded-full bg-white absolute top-0.5 right-0.5" />
                </div>
              </div>
              {/* Cute Cat Mouth & Blush */}
              <div className="flex items-center justify-between w-9 -mt-0.5">
                <div className="w-2 h-1 rounded-full bg-[#fda4af]" />
                <div className="w-3.5 h-1.5 border-b-2 border-[#1e1008] rounded-full" />
                <div className="w-2 h-1 rounded-full bg-[#fda4af]" />
              </div>
            </div>
          </motion.div>
          <span className="absolute -bottom-1 -right-1 text-xl drop-shadow-sm">🧋</span>
        </div>

        {/* Friendly Indonesian Game Over Title */}
        <h2 className="text-2xl font-black text-[#5C3A21] font-['Fredoka'] tracking-tight flex items-center gap-1.5 justify-center">
          Cangkirnya Penuh! 🧋
        </h2>
        <p className="text-xs text-[#8A6348] mt-0.5 font-medium">
          Top boba kamu: <strong className="text-[#5C3A21] font-bold">{highestTierReached.name}</strong>
        </p>

        {/* Rekor Baru! 🏆 Highlight Banner */}
        {isNewBest ? (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="my-2 px-3.5 py-1 bg-gradient-to-r from-[#FDE68A] via-[#FBBF24] to-[#F59E0B] text-[#78350F] rounded-full text-xs font-black flex items-center gap-1.5 shadow-[0_2px_10px_rgba(245,158,11,0.35)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B45309]" />
            Rekor Baru! 🏆
            <Sparkles className="w-3.5 h-3.5 text-[#B45309]" />
          </motion.div>
        ) : (
          <div className="my-1" />
        )}

        {/* Score Breakdown Cards */}
        <div className="w-full grid grid-cols-2 gap-2 my-2">
          <div className="bg-white/90 border border-[#FDE8D7] rounded-2xl p-2.5 shadow-sm flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A87C5E] flex items-center gap-1">
              <Award className="w-3 h-3 text-[#F97316]" /> Final Score
            </span>
            <span className="text-xl font-black text-[#5C3A21] font-['Fredoka'] mt-0.5">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="bg-white/90 border border-[#FDE8D7] rounded-2xl p-2.5 shadow-sm flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A87C5E] flex items-center gap-1">
              <Trophy className="w-3 h-3 text-[#EAB308]" /> Best Score
            </span>
            <span className="text-xl font-black text-[#854D0E] font-['Fredoka'] mt-0.5">
              {bestScore.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons: Main Lagi + Pamerkan Skor */}
        <div className="w-full flex flex-col gap-2 mt-1">
          {/* Bubbly Main Lagi Restart Button */}
          <motion.button
            id="play-again-btn"
            onClick={onRestart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#EA580C] text-white font-black text-base shadow-[0_4px_16px_rgba(249,115,22,0.35)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer font-['Fredoka']"
          >
            <RotateCcw className="w-5 h-5" />
            Main Lagi
          </motion.button>

          {/* Pamerkan Skor (Web Share API) Button */}
          <motion.button
            id="share-score-btn"
            onClick={handleShare}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="w-full py-2.5 px-5 rounded-2xl bg-[#FFF7ED] hover:bg-[#FFEDD5] border-2 border-[#FED7AA] text-[#7C2D12] font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer font-['Fredoka'] active:bg-[#FDBA74]"
          >
            <Share2 className="w-4 h-4 text-[#EA580C]" />
            Pamerkan Skor ✨
          </motion.button>
        </div>

        {/* Clean & Modest Developer Attribution */}
        <div className="mt-3.5 pt-2.5 w-full border-t border-[#F3DED0]/70 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-500 leading-none">
            <span>Dibuat oleh</span>
            <span className="font-semibold text-zinc-800 inline-flex items-center gap-1">
              nikoDev
              <Sparkles size={13} className="text-emerald-500 inline-block shrink-0" />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

