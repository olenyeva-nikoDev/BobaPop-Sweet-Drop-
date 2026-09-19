import React from 'react';
import { Sparkles } from 'lucide-react';

export const FooterAttribution: React.FC = () => {
  return (
    <footer className="w-full pt-1 pb-[calc(env(safe-area-inset-bottom,8px)+4px)] z-20 flex items-center justify-center shrink-0 select-none pointer-events-auto">
      <div
        id="nikodev-attribution-badge"
        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/75 backdrop-blur-md border border-[#EBE3DC]/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] text-[12px] font-medium text-zinc-600 transition-all hover:bg-white/90"
      >
        <span>Website ini dibuat oleh</span>
        <span className="font-semibold text-zinc-800 inline-flex items-center gap-1">
          nikoDev
          <Sparkles size={13} className="text-emerald-500 inline-block shrink-0" />
        </span>
      </div>
    </footer>
  );
};

