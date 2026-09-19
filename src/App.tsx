import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BobaCupCanvas } from './components/BobaCupCanvas';
import { FooterAttribution } from './components/FooterAttribution';
import { GameOverModal } from './components/GameOverModal';
import { EvolutionCycleModal } from './components/EvolutionCycleModal';
import { BOBA_TIERS } from './data/bobaTiers';
import { BobaTier } from './types';
import { soundManager } from './utils/sound';

export default function App() {
  // Score state
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bobapop_best_score');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Random tier generator for dropping: only Tiers 1 to 3 (Brown Sugar Boba, Taro Pearl, Matcha Bubble)
  const getRandomSpawnTier = useCallback((): BobaTier => {
    // Balanced distribution among dropping tiers: Tier 1 (45%), Tier 2 (35%), Tier 3 (20%)
    const rand = Math.random();
    if (rand < 0.45) return BOBA_TIERS[0];
    if (rand < 0.80) return BOBA_TIERS[1];
    return BOBA_TIERS[2];
  }, []);

  const [currentTier, setCurrentTier] = useState<BobaTier>(() => getRandomSpawnTier());
  const [nextTier, setNextTier] = useState<BobaTier>(() => getRandomSpawnTier());
  const [highestTierReached, setHighestTierReached] = useState<BobaTier>(BOBA_TIERS[0]);

  // Modal & Audio states
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [showEvolution, setShowEvolution] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.getMuted());
  const [gameKey, setGameKey] = useState<number>(0);

  // Update best score whenever score surpasses it
  const handleScoreAdd = useCallback((points: number) => {
    setScore((prev) => {
      const newScore = prev + points;
      setBestScore((currentBest) => {
        if (newScore > currentBest) {
          try {
            localStorage.setItem('bobapop_best_score', newScore.toString());
          } catch {
            // ignore
          }
          return newScore;
        }
        return currentBest;
      });
      return newScore;
    });
  }, []);

  // When a boba is dropped, slide the next tier into current and pick a new next tier
  const handleBobaDropped = useCallback(() => {
    setCurrentTier(nextTier);
    setNextTier(getRandomSpawnTier());
  }, [nextTier, getRandomSpawnTier]);

  // Track highest tier achieved in the current run
  const handleHighestTierUpdate = useCallback((tier: BobaTier) => {
    setHighestTierReached((prev) => (tier.tier > prev.tier ? tier : prev));
  }, []);

  // Sound toggle
  const handleToggleMute = useCallback(() => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  }, []);

  // Restart game
  const handleRestart = useCallback(() => {
    setIsGameOver(false);
    setScore(0);
    setCurrentTier(getRandomSpawnTier());
    setNextTier(getRandomSpawnTier());
    setHighestTierReached(BOBA_TIERS[0]);
    setGameKey((prev) => prev + 1);
  }, [getRandomSpawnTier]);

  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    soundManager.playGameOver();
  }, []);

  // Prevent default scroll behavior and elastic bounce on mobile
  useEffect(() => {
    const preventTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventTouch, { passive: false });
    return () => document.removeEventListener('touchmove', preventTouch);
  }, []);

  return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-[#2b211a] p-0 sm:p-4 overflow-hidden select-none">
      {/* Outer ambient decorative glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-[#f97316]/10 via-[#f472b6]/15 to-[#818cf8]/10 rounded-full blur-3xl opacity-60" />
      </div>

      {/* Mobile-First Frame Container */}
      <main
        id="bobapop-mobile-frame"
        className="relative w-full max-w-[420px] h-[100dvh] max-h-[100dvh] bg-gradient-to-b from-[#FFFDF9] via-[#FFF7ED] to-[#FED7AA]/35 sm:rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.35)] border-0 sm:border-4 border-[#FDE8D7] flex flex-col overflow-hidden ambient-glow"
        style={{ touchAction: 'none' }}
      >
        {/* Soft background milk tea decorative elements */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-0" />
        <div className="absolute bottom-10 -right-8 w-32 h-32 bg-[#FDBA74]/15 rounded-full blur-xl pointer-events-none z-0" />
        <div className="absolute top-36 -left-8 w-28 h-28 bg-[#F472B6]/10 rounded-full blur-xl pointer-events-none z-0" />

        {/* 1. Header (Title, Score, Best, Next preview, and Controls) */}
        <Header
          score={score}
          bestScore={bestScore}
          nextTier={nextTier}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onRestart={handleRestart}
          onOpenEvolution={() => setShowEvolution(true)}
        />

        {/* 2. Physics Canvas Container (Translucent frosted-glass cup & 2D Matter.js bodies) */}
        <BobaCupCanvas
          currentTier={currentTier}
          onBobaDropped={handleBobaDropped}
          onScoreAdd={handleScoreAdd}
          onHighestTierUpdate={handleHighestTierUpdate}
          onGameOver={handleGameOver}
          isGameOver={isGameOver}
          gameKey={gameKey}
        />

        {/* 3. Footer Attribution Badge */}
        <FooterAttribution />

        {/* 4. Game Over Overlay Modal */}
        {isGameOver && (
          <GameOverModal
            score={score}
            bestScore={bestScore}
            highestTierReached={highestTierReached}
            onRestart={handleRestart}
          />
        )}

        {/* 5. Evolution Cycle Modal */}
        <EvolutionCycleModal
          isOpen={showEvolution}
          onClose={() => setShowEvolution(false)}
        />
      </main>
    </div>
  );
}
