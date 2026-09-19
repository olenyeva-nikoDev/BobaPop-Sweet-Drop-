import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import confetti from 'canvas-confetti';
import { BOBA_TIERS } from '../data/bobaTiers';
import { BobaTier, Particle, ScorePopup, ComboFloaty } from '../types';
import { soundManager, triggerDropHaptic, triggerMergeHaptic } from '../utils/sound';

interface BobaCupCanvasProps {
  currentTier: BobaTier;
  onBobaDropped: () => void;
  onScoreAdd: (points: number) => void;
  onHighestTierUpdate: (tier: BobaTier) => void;
  onGameOver: () => void;
  isGameOver: boolean;
  gameKey: number; // Increment to reset game physics
}

// Extend Matter.Body for custom properties
interface CustomBody extends Matter.Body {
  bobaTier?: number;
  bobaId?: number;
  createdAt?: number;
  isMerging?: boolean;
  squishStartTime?: number;
}

export const BobaCupCanvas: React.FC<BobaCupCanvasProps> = ({
  currentTier,
  onBobaDropped,
  onScoreAdd,
  onHighestTierUpdate,
  onGameOver,
  isGameOver,
  gameKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Gameplay state refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const bodiesMapRef = useRef<Map<number, CustomBody>>(new Map());

  const aimXRef = useRef<number>(180);
  const targetAimXRef = useRef<number>(180);
  const isPointerDownRef = useRef<boolean>(false);
  const canDropRef = useRef<boolean>(true);
  const isCooldownRef = useRef<boolean>(false);
  const popInStartTimeRef = useRef<number>(0);
  const [canDropState, setCanDropState] = useState<boolean>(true);

  // Particles & Floating Scores & Encouragement Floaties
  const particlesRef = useRef<Particle[]>([]);
  const scorePopupsRef = useRef<ScorePopup[]>([]);
  const comboFloatiesRef = useRef<ComboFloaty[]>([]);
  const nextParticleIdRef = useRef<number>(1);
  const nextPopupIdRef = useRef<number>(1);
  const nextComboIdRef = useRef<number>(1);

  // Friendly Combo tracking (< 1.3 seconds between merges)
  const lastMergeTimeRef = useRef<number>(0);
  const comboCountRef = useRef<number>(0);

  // Danger Line Warning
  const dangerTimerRef = useRef<number>(0);
  const [dangerWarning, setDangerWarning] = useState<boolean>(false);

  // Canvas Dimensions
  const [dimensions, setDimensions] = useState({ width: 360, height: 560 });
  const dimensionsRef = useRef({ width: 360, height: 560 });
  dimensionsRef.current = dimensions;

  // Cup layout geometry
  const cupPaddingX = 14;
  const cupTopY = 72; // Danger line height (boba rests safely below)
  const dropY = 34; // Hovering dropper spawn height (safely above danger line)

  // Helper to generate unique boba ID
  const bobaIdCounter = useRef<number>(1);

  // Helper to clamp X within cup boundaries based on boba radius
  const getClampedX = useCallback((x: number, radius: number, width: number) => {
    const minX = cupPaddingX + radius + 4;
    const maxX = width - cupPaddingX - radius - 4;
    return Math.max(minX, Math.min(maxX, x));
  }, []);

  // Add gentle sweep particle burst across the cup when restarting
  const triggerCupClearSweep = () => {
    const { width, height } = dimensionsRef.current;
    const colors = ['#f472b6', '#fed7aa', '#818cf8', '#fef08a', '#6ee7b7', '#ffffff'];
    for (let i = 0; i < 28; i++) {
      const x = cupPaddingX + Math.random() * (width - cupPaddingX * 2);
      const y = cupTopY + 40 + Math.random() * (height - cupTopY - 70);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // Upward sweep
      const speed = 2 + Math.random() * 4.5;
      const isStar = i % 2 === 0;

      particlesRef.current.push({
        id: nextParticleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        radius: isStar ? 3.5 + Math.random() * 2.5 : 2.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 35 + Math.floor(Math.random() * 15),
        shape: isStar ? 'star' : 'dot',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.15,
        wobbleSpeed: 0.1,
      });
    }
  };

  // Trigger high-tier confetti celebration
  const triggerConfettiCelebration = (x: number, y: number) => {
    soundManager.playCelebration();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const normX = (rect.left + x) / window.innerWidth;
    const normY = (rect.top + y) / window.innerHeight;

    confetti({
      particleCount: 45,
      spread: 60,
      origin: { x: normX, y: normY },
      colors: ['#f472b6', '#fb923c', '#fde047', '#818cf8', '#6ee7b7'],
      disableForReducedMotion: true,
    });
  };

  // Draw rounded pill helper for badges
  const drawPillPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  // Emit 12-16 tiny pastel star particles and soft dots matching boba's color
  const addMergeParticles = (x: number, y: number, color: string, count = 15) => {
    const pastelPalette = [
      color,
      '#FEF08A', // Soft pastel star yellow
      '#FBCFE8', // Soft pastel strawberry pink
      '#E9D5FF', // Soft pastel taro lavender
      '#BAE6FD', // Soft pastel sky blue
      '#FFFFFF', // Creamy milk white
    ];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 1.6 + Math.random() * 3.4;
      const isStar = i % 2 === 0;
      const chosenColor = pastelPalette[Math.floor(Math.random() * pastelPalette.length)];

      particlesRef.current.push({
        id: nextParticleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.75, // Gentle initial upward pop
        radius: isStar ? 3.5 + Math.random() * 2.5 : 2.5 + Math.random() * 2.5,
        color: chosenColor,
        alpha: 1,
        life: 0,
        maxLife: 38 + Math.floor(Math.random() * 16), // Gentle float down
        shape: isStar ? 'star' : 'dot',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.12,
        wobbleSpeed: 0.08 + Math.random() * 0.06,
      });
    }
  };

  // Add floating score indicator with optional multiplier badge
  const addScorePopup = (
    x: number,
    y: number,
    points: number,
    tierColor: string,
    multiplier = 1
  ) => {
    scorePopupsRef.current.push({
      id: nextPopupIdRef.current++,
      x,
      y: y - 10,
      text: `+${points}`,
      multiplier,
      alpha: 1,
      scale: multiplier > 1 ? 1.3 : 1,
      tierColor,
    });
  };

  // Add friendly bouncy combo encouragement floaty
  const addComboFloaty = (
    x: number,
    y: number,
    text: string,
    multiplier: number,
    color: string
  ) => {
    const width = dimensionsRef.current.width;
    const clampedX = Math.max(54, Math.min(width - 54, x));
    const clampedY = Math.max(cupTopY + 24, y);

    comboFloatiesRef.current.push({
      id: nextComboIdRef.current++,
      x: clampedX,
      y: clampedY,
      text,
      multiplier,
      alpha: 1,
      scale: 0.3,
      rotation: (Math.random() - 0.5) * 0.16,
      life: 0,
      maxLife: 50,
      color,
    });
  };

  // Create a boba physics body with bouncy, elastic physics
  const createBobaBody = (x: number, y: number, tierIndex: number, isInitialDrop = false): CustomBody => {
    const tier = BOBA_TIERS[tierIndex];
    const body = Matter.Bodies.circle(x, y, tier.radius, {
      restitution: 0.35,
      friction: 0.08,
      frictionAir: 0.005,
      density: 0.0012,
      label: `boba-${tierIndex}`,
    }) as CustomBody;

    body.bobaTier = tierIndex;
    body.bobaId = bobaIdCounter.current++;
    body.createdAt = Date.now();
    body.isMerging = false;
    body.squishStartTime = 0;

    if (isInitialDrop) {
      // Gentle subtle rotational twist
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
    }

    return body;
  };

  // Initialize Physics Engine & Cup Boundaries
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 560;
    setDimensions({ width, height });
    dimensionsRef.current = { width, height };

    // Create Matter Engine
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.1, scale: 0.001 },
      constraintIterations: 2,
      positionIterations: 6,
      velocityIterations: 4,
    });
    engineRef.current = engine;

    const cupWidth = width - cupPaddingX * 2;
    const cupHeight = height - cupTopY - 14;
    const cupBottomY = height - 14;
    const wallThickness = 50;

    // Physics Boundaries (Left Wall, Right Wall, Bottom Floor, and Chamfers for rounded corners)
    const leftWall = Matter.Bodies.rectangle(
      cupPaddingX - wallThickness / 2,
      cupTopY + cupHeight / 2,
      wallThickness,
      cupHeight + 100,
      { isStatic: true, friction: 0.2, restitution: 0.1 }
    );

    const rightWall = Matter.Bodies.rectangle(
      width - cupPaddingX + wallThickness / 2,
      cupTopY + cupHeight / 2,
      wallThickness,
      cupHeight + 100,
      { isStatic: true, friction: 0.2, restitution: 0.1 }
    );

    const bottomFloor = Matter.Bodies.rectangle(
      width / 2,
      cupBottomY + wallThickness / 2,
      cupWidth + wallThickness * 2,
      wallThickness,
      { isStatic: true, friction: 0.3, restitution: 0.15 }
    );

    // Rounded corner wedges at bottom-left and bottom-right
    const cornerSize = 28;
    const bottomLeftCorner = Matter.Bodies.rectangle(
      cupPaddingX + cornerSize * 0.35,
      cupBottomY - cornerSize * 0.35,
      cornerSize * 1.4,
      cornerSize * 0.5,
      {
        isStatic: true,
        angle: Math.PI / 4,
        friction: 0.2,
      }
    );

    const bottomRightCorner = Matter.Bodies.rectangle(
      width - cupPaddingX - cornerSize * 0.35,
      cupBottomY - cornerSize * 0.35,
      cornerSize * 1.4,
      cornerSize * 0.5,
      {
        isStatic: true,
        angle: -Math.PI / 4,
        friction: 0.2,
      }
    );

    Matter.Composite.add(engine.world, [leftWall, rightWall, bottomFloor, bottomLeftCorner, bottomRightCorner]);

    // Handle Collisions & Merges
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs;
      const now = performance.now();

      for (let i = 0; i < pairs.length; i++) {
        const { bodyA, bodyB } = pairs[i];
        const a = bodyA as CustomBody;
        const b = bodyB as CustomBody;

        // Trigger chewy gelatinous squish effect on collision (150ms spring-back)
        if (a.bobaTier !== undefined && !a.isMerging) {
          a.squishStartTime = now;
        }
        if (b.bobaTier !== undefined && !b.isMerging) {
          b.squishStartTime = now;
        }

        if (
          a.bobaTier !== undefined &&
          b.bobaTier !== undefined &&
          a.bobaTier === b.bobaTier &&
          !a.isMerging &&
          !b.isMerging
        ) {
          a.isMerging = true;
          b.isMerging = true;

          const currentTierIndex = a.bobaTier;
          const tierInfo = BOBA_TIERS[currentTierIndex];
          const nextTierIndex = currentTierIndex + 1;

          // Midpoint of merge
          const midX = (a.position.x + b.position.x) / 2;
          const midY = (a.position.y + b.position.y) / 2;

          // Friendly Combo Calculation (< 1.3 seconds between merges)
          const nowMerge = performance.now();
          let currentCombo = 1;
          if (nowMerge - lastMergeTimeRef.current < 1300 && lastMergeTimeRef.current > 0) {
            comboCountRef.current += 1;
            currentCombo = comboCountRef.current;
          } else {
            comboCountRef.current = 1;
            currentCombo = 1;
          }
          lastMergeTimeRef.current = nowMerge;

          const multiplier = currentCombo >= 2 ? Math.min(currentCombo, 5) : 1;
          const finalPoints = tierInfo.points * multiplier;

          // Score awarded with combo multiplier
          onScoreAdd(finalPoints);
          addScorePopup(midX, midY, finalPoints, tierInfo.color, multiplier);
          addMergeParticles(midX, midY, tierInfo.color);

          // Friendly Indonesian Combo Encouragement Floaties
          if (currentCombo >= 2) {
            let cheerWord = 'Manis! ✨';
            let cheerColor = '#EC4899'; // Sweet pink
            if (currentCombo === 3) {
              cheerWord = 'Mantap! 💖';
              cheerColor = '#8B5CF6'; // Vibrant purple
            } else if (currentCombo === 4) {
              cheerWord = 'Luar Biasa! 🎉';
              cheerColor = '#F59E0B'; // Golden amber
            } else if (currentCombo >= 5) {
              cheerWord = 'Boba Master! 👑';
              cheerColor = '#EF4444'; // Royal red
            }
            addComboFloaty(midX, midY - 26, cheerWord, multiplier, cheerColor);
          }

          // Audio & Mobile Haptic Vibration
          soundManager.playMerge(currentTierIndex);
          triggerMergeHaptic();

          // Defer physics world mutation
          setTimeout(() => {
            if (!engineRef.current) return;
            Matter.Composite.remove(engineRef.current.world, a);
            Matter.Composite.remove(engineRef.current.world, b);
            bodiesMapRef.current.delete(a.bobaId || 0);
            bodiesMapRef.current.delete(b.bobaId || 0);

            // Spawn next tier if available
            if (nextTierIndex < BOBA_TIERS.length) {
              const nextTierInfo = BOBA_TIERS[nextTierIndex];
              const newBody = createBobaBody(midX, midY, nextTierIndex);
              newBody.squishStartTime = performance.now();

              // Small celebratory bounce pop
              Matter.Body.setVelocity(newBody, {
                x: (Math.random() - 0.5) * 1.5,
                y: -2.2,
              });

              Matter.Composite.add(engineRef.current.world, newBody);
              if (newBody.bobaId) {
                bodiesMapRef.current.set(newBody.bobaId, newBody);
              }

              onHighestTierUpdate(nextTierInfo);

              if (nextTierIndex === 7) {
                // Royal Milk Tea King reached!
                triggerConfettiCelebration(midX, midY);
              }
            } else {
              // Reached beyond Royal Milk Tea King! Bonus points & confetti
              onScoreAdd(1000);
              addScorePopup(midX, midY, 1000, '#eab308');
              triggerConfettiCelebration(midX, midY);
            }
          }, 0);
        }
      }
    };

    Matter.Events.on(engine, 'collisionStart', handleCollision);

    // Create Matter Runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // If restarting game (gameKey > 0), trigger joyful cup clear particle sweep!
    if (gameKey > 0) {
      triggerCupClearSweep();
    }

    // Cleanup
    return () => {
      Matter.Events.off(engine, 'collisionStart', handleCollision);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      runnerRef.current = null;
      bodiesMapRef.current.clear();
      particlesRef.current = [];
      scorePopupsRef.current = [];
      comboFloatiesRef.current = [];
      comboCountRef.current = 0;
      lastMergeTimeRef.current = 0;
    };
  }, [gameKey]);

  // Handle Container Resizing
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth || 360;
      const height = containerRef.current.clientHeight || 560;
      setDimensions({ width, height });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Drop action
  const executeDrop = useCallback(() => {
    if (!canDropRef.current || isCooldownRef.current || isGameOver || !engineRef.current) return;

    const { width } = dimensionsRef.current;
    const clampedX = getClampedX(aimXRef.current, currentTier.radius, width);

    // Disable dropping and start 500ms cooldown
    canDropRef.current = false;
    isCooldownRef.current = true;
    setCanDropState(false);

    // Play soft water bloop drop audio & mobile haptic tap
    soundManager.playDrop();
    triggerDropHaptic();

    // Release boba into Matter.js physics world with bouncy elastic physics
    const newBody = createBobaBody(clampedX, dropY, currentTier.tier, true);
    Matter.Body.setVelocity(newBody, { x: 0, y: 0.8 });
    Matter.Composite.add(engineRef.current.world, newBody);
    if (newBody.bobaId) {
      bodiesMapRef.current.set(newBody.bobaId, newBody);
    }

    // Exactly 500ms soft cooldown before the next boba appears
    setTimeout(() => {
      if (isGameOver) return;
      onBobaDropped(); // Switch to next boba tier
      isCooldownRef.current = false;
      popInStartTimeRef.current = performance.now();
      soundManager.playPop(); // Cheerful pop when next boba arrives

      // Allow 260ms for pop-in bounce animation to settle before accepting drops
      setTimeout(() => {
        canDropRef.current = true;
        setCanDropState(true);
      }, 260);
    }, 500);
  }, [currentTier, isGameOver, onBobaDropped, getClampedX]);

  // Pointer & Touch Events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isGameOver) return;
    soundManager.unlockAudio();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    isPointerDownRef.current = true;
    const x = e.clientX - rect.left;
    const clamped = getClampedX(x, currentTier.radius, dimensionsRef.current.width);

    // Align boba with finger X immediately on touch start / mouse down
    aimXRef.current = clamped;
    targetAimXRef.current = clamped;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isGameOver) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const clamped = getClampedX(x, currentTier.radius, dimensionsRef.current.width);
    // Smoothly drag within cup boundaries
    targetAimXRef.current = clamped;

    if (!isPointerDownRef.current) {
      // If just hovering on desktop mouse, also track smoothly
      targetAimXRef.current = clamped;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      executeDrop();
    }
  };

  // Main Render Loop (Canvas 2D)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;
      const dpr = window.devicePixelRatio || 1;

      // Handle HiDPI
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cupW = width - cupPaddingX * 2;
      const cupH = height - cupTopY - 14;
      const cupBottom = height - 14;
      const cornerRadius = 38;

      // 1. Draw Boba Cup (Soft frosted-glass container with rounded bottom corners)
      ctx.save();

      // Cup shape path
      ctx.beginPath();
      ctx.moveTo(cupPaddingX, cupTopY);
      ctx.lineTo(cupPaddingX, cupBottom - cornerRadius);
      ctx.arcTo(cupPaddingX, cupBottom, cupPaddingX + cornerRadius, cupBottom, cornerRadius);
      ctx.lineTo(width - cupPaddingX - cornerRadius, cupBottom);
      ctx.arcTo(width - cupPaddingX, cupBottom, width - cupPaddingX, cupBottom - cornerRadius, cornerRadius);
      ctx.lineTo(width - cupPaddingX, cupTopY);

      // Glass fill (soft creamy milk tea gradient)
      const cupGrad = ctx.createLinearGradient(0, cupTopY, 0, cupBottom);
      cupGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      cupGrad.addColorStop(0.7, 'rgba(254, 243, 230, 0.35)');
      cupGrad.addColorStop(1, 'rgba(253, 230, 205, 0.45)');
      ctx.fillStyle = cupGrad;
      ctx.fill();

      // Frosted cup border
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      // Subtle inner rim shadow
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(217, 168, 130, 0.25)';
      ctx.stroke();

      // Cute measurement marks on the cup (like a real milk tea tumbler!)
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      const markY1 = cupTopY + cupH * 0.35;
      const markY2 = cupTopY + cupH * 0.65;
      ctx.beginPath();
      ctx.moveTo(cupPaddingX + 8, markY1);
      ctx.lineTo(cupPaddingX + 18, markY1);
      ctx.moveTo(cupPaddingX + 8, markY2);
      ctx.lineTo(cupPaddingX + 24, markY2);
      ctx.stroke();

      ctx.restore();

      // 2. Danger Line & Overfill Detection (3-second gentle danger zone)
      const allBodies = Matter.Composite.allBodies(engine.world) as CustomBody[];
      let hasOverfill = false;
      const now = Date.now();

      allBodies.forEach((b) => {
        if (b.bobaTier !== undefined && b.createdAt && now - b.createdAt > 1500) {
          const tier = BOBA_TIERS[b.bobaTier];
          const topEdge = b.position.y - tier.radius;
          const speed = Matter.Vector.magnitude(b.velocity);

          // If settled resting near or above danger line
          if (topEdge < cupTopY && speed < 1.6) {
            hasOverfill = true;
          }
        }
      });

      if (hasOverfill && !isGameOver) {
        dangerTimerRef.current += 1 / 60;
        setDangerWarning(true);
        if (dangerTimerRef.current >= 3.0) {
          onGameOver();
        }
      } else {
        dangerTimerRef.current = Math.max(0, dangerTimerRef.current - 1 / 90);
        if (dangerTimerRef.current < 0.15) {
          setDangerWarning(false);
        }
      }

      // Draw dashed danger line: pulses softly in coral red when threatened
      ctx.save();
      const isDangerActive = dangerTimerRef.current > 0;
      const pulseT = performance.now() / 250;
      const coralPulse = 0.55 + 0.4 * Math.sin(pulseT);

      ctx.beginPath();
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = isDangerActive ? 2.5 : 2;
      ctx.strokeStyle = isDangerActive
        ? `rgba(248, 113, 113, ${coralPulse})` // Coral red pulse
        : 'rgba(244, 114, 182, 0.45)'; // Soft strawberry pink idle
      ctx.moveTo(cupPaddingX + 2, cupTopY);
      ctx.lineTo(width - cupPaddingX - 2, cupTopY);
      ctx.stroke();

      // Friendly floating countdown badge ("Awas kepenuhan! 3.. 2.. 1..")
      if (dangerTimerRef.current > 0.25) {
        const remainingSeconds = Math.max(1, Math.ceil(3.0 - dangerTimerRef.current));
        const badgeText = `⚠️ Awas kepenuhan! ${remainingSeconds}..`;
        
        ctx.font = "900 12px 'Fredoka', 'Nunito', sans-serif";
        const textMetrics = ctx.measureText(badgeText);
        const badgeW = textMetrics.width + 20;
        const badgeH = 22;
        const badgeX = width / 2 - badgeW / 2;
        const badgeY = cupTopY - 26;
        const badgeRadius = badgeH / 2;

        // Badge pill background in soft translucent coral red
        ctx.save();
        ctx.shadowColor = 'rgba(239, 68, 68, 0.35)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FEF2F2';
        drawPillPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeRadius);
        ctx.fill();

        ctx.strokeStyle = '#F87171';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#DC2626';
        ctx.fillText(badgeText, width / 2, badgeY + badgeH / 2);
      }
      ctx.restore();

      // 3. Aim Guide Line & Dropper Preview (Top area)
      // Smoothly interpolate aimX towards targetAimX for buttery fluid tracking
      aimXRef.current += (targetAimXRef.current - aimXRef.current) * 0.28;
      const clampedAimX = getClampedX(aimXRef.current, currentTier.radius, width);
      aimXRef.current = clampedAimX;

      if (!isGameOver) {
        // Pastel Aim Guide Line (Vertical dotted line pointing downward from hovering boba into cup)
        if (!isCooldownRef.current) {
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([5, 6]);
          ctx.lineWidth = 2;

          const guideGrad = ctx.createLinearGradient(0, dropY + currentTier.radius + 4, 0, cupBottom - 8);
          guideGrad.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
          guideGrad.addColorStop(0.65, 'rgba(244, 114, 182, 0.4)');
          guideGrad.addColorStop(1, 'rgba(251, 146, 60, 0.15)');
          ctx.strokeStyle = guideGrad;

          ctx.moveTo(clampedAimX, dropY + currentTier.radius + 4);
          ctx.lineTo(clampedAimX, cupBottom - 8);
          ctx.stroke();

          // Soft pastel landing target dot at the bottom
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.arc(clampedAimX, cupBottom - 8, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(clampedAimX, cupBottom - 8, 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Dropper Straw Indicator at very top
        ctx.save();
        ctx.fillStyle = '#fbd3b6';
        ctx.strokeStyle = '#f5b588';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(clampedAimX - 7, 0, 14, 16, [0, 0, 4, 4]);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Hovering Dropper Boba (with gentle pop-in bounce animation and breathing float)
        if (!isCooldownRef.current) {
          let bounceScale = 1.0;
          if (popInStartTimeRef.current > 0) {
            const elapsed = (performance.now() - popInStartTimeRef.current) / 260;
            if (elapsed < 1) {
              // Elastic overshoot bounce curve: pops up to ~1.2x and settles gracefully
              bounceScale = Math.sin(elapsed * Math.PI * 0.5) * (1 + 0.28 * Math.sin((1 - elapsed) * Math.PI * 2));
            }
          }

          const breatheOffset = Math.sin(Date.now() / 260) * 2;
          drawKawaiiBoba(
            ctx,
            clampedAimX,
            dropY + breatheOffset,
            Math.max(2, currentTier.radius * bounceScale),
            0,
            currentTier,
            1
          );
        }
      }

      // 4. Render All Physics Boba Bodies
      allBodies.forEach((body) => {
        if (body.bobaTier !== undefined) {
          const tier = BOBA_TIERS[body.bobaTier];
          const topEdge = body.position.y - tier.radius;
          const speed = Matter.Vector.magnitude(body.velocity);

          // Dynamic Emotion: Worried / dizzy face when resting high up near red danger zone
          const isWorried = topEdge < cupTopY + 40 && (now - (body.createdAt || 0) > 600) && speed < 2.5;

          // Soft Bouncy Squish: On collision, compress scale (squash on Y, stretch on X) and spring back in 150ms
          let scaleX = 1;
          let scaleY = 1;
          if (body.squishStartTime) {
            const elapsed = performance.now() - body.squishStartTime;
            if (elapsed < 150) {
              const progress = elapsed / 150; // 0 to 1
              // Spring back damped curve: squash on Y, stretch on X
              const squishFactor = Math.sin(progress * Math.PI) * (1 - progress) * 0.24;
              scaleX = 1 + squishFactor;
              scaleY = 1 - squishFactor;
            }
          }

          drawKawaiiBoba(
            ctx,
            body.position.x,
            body.position.y,
            tier.radius,
            body.angle,
            tier,
            1,
            isWorried,
            scaleX,
            scaleY
          );
        }
      });

      // 5. Render Particle Bursts (Pastel Stars & Soft Dots)
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96; // air drag
        p.vy = Math.min(1.5, p.vy + 0.045); // gentle float down
        p.life++;
        // Soft side-to-side floating flutter
        p.x += Math.sin(p.life * (p.wobbleSpeed || 0.1) + p.id) * 0.35;
        if (p.rotation !== undefined && p.vRot !== undefined) {
          p.rotation += p.vRot;
        }
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.shape === 'star') {
          // Draw cute 4-point sparkle anime star
          const r = p.radius * (1 - (p.life / p.maxLife) * 0.3);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation || 0);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.quadraticCurveTo(0, 0, 0, r);
          ctx.quadraticCurveTo(0, 0, -r, 0);
          ctx.quadraticCurveTo(0, 0, 0, -r);
          ctx.closePath();
          ctx.fill();

          // Delicate white core glint
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.6, r * 0.32), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Soft pastel dot with delicate ambient highlight
          const r = p.radius * (1 - (p.life / p.maxLife) * 0.3);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Creamy highlight spot
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.beginPath();
          ctx.arc(p.x - r * 0.28, p.y - r * 0.28, r * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(idx, 1);
        }
      });

      // 6. Render Floating Score Popups with colorful pop animations
      scorePopupsRef.current.forEach((popup, idx) => {
        popup.y -= 1.1;
        popup.alpha -= 0.022;
        popup.scale = Math.min(1.25, popup.scale + 0.025);

        ctx.save();
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.translate(popup.x, popup.y);
        ctx.scale(popup.scale, popup.scale);

        const isComboScore = Boolean(popup.multiplier && popup.multiplier > 1);
        ctx.font = isComboScore
          ? "900 16px 'Fredoka', 'Nunito', sans-serif"
          : "900 14px 'Fredoka', 'Nunito', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer white stroke
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(popup.text, 0, 0);

        // Core score text in warm rich brown or vibrant amber for multipliers
        ctx.fillStyle = isComboScore ? '#EA580C' : '#5C3A21';
        ctx.fillText(popup.text, 0, 0);

        // Multiplier tag on the top-right of score if combo
        if (isComboScore) {
          const badgeText = `x${popup.multiplier}`;
          ctx.font = "900 12px 'Fredoka', 'Nunito', sans-serif";
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.strokeText(badgeText, 24, -8);
          ctx.fillStyle = '#EF4444';
          ctx.fillText(badgeText, 24, -8);
        }

        ctx.restore();

        if (popup.alpha <= 0) {
          scorePopupsRef.current.splice(idx, 1);
        }
      });

      // 7. Render Friendly Indonesian Combo Encouragement Floaties
      comboFloatiesRef.current.forEach((cf, idx) => {
        cf.life++;
        cf.y -= 0.85; // gentle upward drift

        // Bouncy spring scale: fast pop to ~1.28 then settle to 1.05
        if (cf.life <= 12) {
          const t = cf.life / 12;
          cf.scale = 0.3 + 0.98 * Math.sin(t * Math.PI * 0.78);
        } else {
          cf.scale = Math.max(1.0, cf.scale - 0.008);
        }

        // Smooth fade out in the last 40% of lifespan
        const fadeStart = cf.maxLife * 0.55;
        if (cf.life > fadeStart) {
          cf.alpha = Math.max(0, 1 - (cf.life - fadeStart) / (cf.maxLife - fadeStart));
        }

        ctx.save();
        ctx.globalAlpha = cf.alpha;
        ctx.translate(cf.x, cf.y);
        ctx.rotate(cf.rotation);
        ctx.scale(cf.scale, cf.scale);

        // Text styling: bold friendly rounded typography
        ctx.font = "900 19px 'Fredoka', 'Nunito', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Drop shadow for cute depth
        ctx.shadowColor = 'rgba(74, 45, 23, 0.25)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2.5;

        // Thick clean white outline
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineJoin = 'round';
        ctx.strokeText(cf.text, 0, 0);

        // Core text with vibrant color
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = cf.color;
        ctx.fillText(cf.text, 0, 0);

        // Multiplier badge pill right below the cheering text
        const pillText = `Combo x${cf.multiplier}!`;
        ctx.font = "900 11px 'Fredoka', 'Nunito', sans-serif";
        const pillWidth = ctx.measureText(pillText).width + 14;
        const pillHeight = 16;
        const pillY = 14;
        const r = pillHeight / 2;

        // Draw pill background
        ctx.fillStyle = cf.color;
        drawPillPath(ctx, -pillWidth / 2, pillY - r, pillWidth, pillHeight, r);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // White text inside pill
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(pillText, 0, pillY);

        ctx.restore();

        if (cf.life >= cf.maxLife || cf.alpha <= 0) {
          comboFloatiesRef.current.splice(idx, 1);
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentTier, canDropState, isGameOver, onGameOver, onHighestTierUpdate, onScoreAdd, getClampedX]);

  // Function to render a single delightful, kawaii boba pearl with shiny speculars, 3D highlights & facial expression
  const drawKawaiiBoba = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    angle: number,
    tier: BobaTier,
    alpha = 1,
    isWorried = false,
    scaleX = 1,
    scaleY = 1
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // Apply chewy gelatinous squish scale (squash on Y, stretch on X)
    ctx.scale(scaleX, scaleY);

    // 1. Soft ambient drop shadow
    ctx.beginPath();
    ctx.arc(0, 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(69, 26, 3, 0.12)';
    ctx.fill();

    // 2. 3D Spherical Radial Gradient
    const sphereGrad = ctx.createRadialGradient(
      -radius * 0.32,
      -radius * 0.36,
      radius * 0.08,
      0,
      0,
      radius
    );
    sphereGrad.addColorStop(0, tier.colorLight);
    sphereGrad.addColorStop(0.68, tier.color);
    sphereGrad.addColorStop(1, tier.colorDark);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Translucent gelatinous ambient bounce reflection at bottom-right
    const ambientGrad = ctx.createRadialGradient(
      radius * 0.45,
      radius * 0.45,
      radius * 0.1,
      radius * 0.4,
      radius * 0.4,
      radius * 0.55
    );
    ambientGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    ambientGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = ambientGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Subtle edge rim outline
    ctx.lineWidth = Math.max(1, radius * 0.045);
    ctx.strokeStyle = tier.colorDark;
    ctx.stroke();

    // 3. Glossy, soft 3D-like highlight curve along the upper-left crest
    ctx.save();
    ctx.rotate(-Math.PI / 4.5);
    // Smooth crescent-curved gloss highlight
    ctx.beginPath();
    ctx.ellipse(-radius * 0.18, -radius * 0.52, radius * 0.42, radius * 0.16, 0, 0, Math.PI * 2);
    const glossGrad = ctx.createLinearGradient(
      -radius * 0.6,
      -radius * 0.52,
      radius * 0.24,
      -radius * 0.52
    );
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    glossGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.45)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = glossGrad;
    ctx.fill();

    // Secondary little sparkle star / dot highlight
    ctx.beginPath();
    ctx.arc(radius * 0.32, -radius * 0.36, Math.max(1.5, radius * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
    ctx.restore();

    // 4. Kawaii Face (Rotate softly with physics angle, damped so faces stay upright)
    ctx.rotate(angle * 0.32);

    const eyeSize = Math.max(2.4, radius * 0.13);
    const eyeSpacing = radius * 0.33;
    const eyeY = -radius * 0.05;

    // A. Cute rosy blush cheeks (#FDA4AF)
    if (radius >= 18) {
      const blushW = radius * 0.14;
      const blushH = radius * 0.08;
      const blushY = eyeY + radius * 0.15;
      const leftBlushX = -eyeSpacing - radius * 0.1;
      const rightBlushX = eyeSpacing + radius * 0.1;

      ctx.fillStyle = 'rgba(253, 164, 175, 0.75)'; // #FDA4AF rosy blush
      ctx.beginPath();
      ctx.ellipse(leftBlushX, blushY, blushW, blushH, 0, 0, Math.PI * 2);
      ctx.ellipse(rightBlushX, blushY, blushW, blushH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Delicate kawaii twin blush slashes
      if (radius >= 26) {
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
        ctx.lineWidth = Math.max(1, radius * 0.035);
        ctx.beginPath();
        // Left cheek slashes
        ctx.moveTo(leftBlushX - blushW * 0.35, blushY - blushH * 0.35);
        ctx.lineTo(leftBlushX - blushW * 0.1, blushY + blushH * 0.4);
        ctx.moveTo(leftBlushX + blushW * 0.05, blushY - blushH * 0.35);
        ctx.lineTo(leftBlushX + blushW * 0.3, blushY + blushH * 0.4);
        // Right cheek slashes
        ctx.moveTo(rightBlushX - blushW * 0.35, blushY - blushH * 0.35);
        ctx.lineTo(rightBlushX - blushW * 0.1, blushY + blushH * 0.4);
        ctx.moveTo(rightBlushX + blushW * 0.05, blushY - blushH * 0.35);
        ctx.lineTo(rightBlushX + blushW * 0.3, blushY + blushH * 0.4);
        ctx.stroke();
      }
    }

    if (isWorried) {
      // DYNAMIC EMOTION: Worried / Dizzy near red danger zone!
      // 1. Worried eyebrows angled upward
      ctx.lineWidth = Math.max(1.4, radius * 0.05);
      ctx.strokeStyle = 'rgba(28, 12, 6, 0.88)';
      ctx.beginPath();
      ctx.moveTo(-eyeSpacing - eyeSize * 0.8, eyeY - eyeSize * 1.3);
      ctx.lineTo(-eyeSpacing + eyeSize * 0.7, eyeY - eyeSize * 0.7);
      ctx.moveTo(eyeSpacing + eyeSize * 0.8, eyeY - eyeSize * 1.3);
      ctx.lineTo(eyeSpacing - eyeSize * 0.7, eyeY - eyeSize * 0.7);
      ctx.stroke();

      // 2. Teary watery eyes with glistening catchlights
      ctx.fillStyle = 'rgba(28, 12, 6, 0.92)';
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.arc(eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      // Teary white catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-eyeSpacing - eyeSize * 0.2, eyeY - eyeSize * 0.25, eyeSize * 0.45, 0, Math.PI * 2);
      ctx.arc(eyeSpacing + eyeSize * 0.2, eyeY - eyeSize * 0.25, eyeSize * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Cute teardrop at outer eye corner (#60A5FA)
      if (radius >= 20) {
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        // Left tear drop
        ctx.moveTo(-eyeSpacing - eyeSize * 1.2, eyeY + eyeSize * 0.3);
        ctx.lineTo(-eyeSpacing - eyeSize * 0.8, eyeY + eyeSize * 1.2);
        ctx.arc(-eyeSpacing - eyeSize * 1.1, eyeY + eyeSize * 1.1, eyeSize * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // White tear highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-eyeSpacing - eyeSize * 1.15, eyeY + eyeSize * 0.95, eyeSize * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Open worried trembling mouth (wavy or gasp 'O')
      ctx.fillStyle = '#1c0c06';
      ctx.strokeStyle = '#1c0c06';
      ctx.lineWidth = Math.max(1.4, radius * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, eyeY + radius * 0.16, radius * 0.07, radius * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pink worried tongue inside
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, eyeY + radius * 0.22, radius * 0.05, Math.PI, 0);
      ctx.fill();
    } else {
      // NORMAL ADORABLE KAWAII FACE
      // Big sparkling anime eyes with double white catchlights
      ctx.fillStyle = 'rgba(28, 12, 6, 0.92)';

      if (tier.face === 'wink') {
        // Left eye: Big sparkling anime eye
        ctx.beginPath();
        ctx.arc(-eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Right eye: Cute wink with upward eyelash flick
        ctx.lineWidth = Math.max(1.8, radius * 0.07);
        ctx.strokeStyle = 'rgba(28, 12, 6, 0.92)';
        ctx.beginPath();
        ctx.arc(eyeSpacing, eyeY + 1, eyeSize * 1.15, Math.PI * 0.85, Math.PI * 2.15);
        ctx.stroke();
        // Eyelash flick
        ctx.beginPath();
        ctx.moveTo(eyeSpacing + eyeSize * 0.9, eyeY + 1);
        ctx.lineTo(eyeSpacing + eyeSize * 1.35, eyeY - eyeSize * 0.35);
        ctx.stroke();

        // Catchlight on left eye (big primary in top-right, small in bottom-left)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-eyeSpacing + eyeSize * 0.35, eyeY - eyeSize * 0.35, eyeSize * 0.44, 0, Math.PI * 2);
        ctx.arc(-eyeSpacing - eyeSize * 0.3, eyeY + eyeSize * 0.3, eyeSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Both eyes: Big sparkling anime eyes
        ctx.beginPath();
        ctx.arc(-eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.arc(eyeSpacing, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // White catchlights (Big primary dot in upper right, smaller secondary dot in lower left)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        // Left eye catchlights
        ctx.arc(-eyeSpacing + eyeSize * 0.32, eyeY - eyeSize * 0.32, eyeSize * 0.44, 0, Math.PI * 2);
        ctx.arc(-eyeSpacing - eyeSize * 0.28, eyeY + eyeSize * 0.28, eyeSize * 0.22, 0, Math.PI * 2);
        // Right eye catchlights
        ctx.arc(eyeSpacing + eyeSize * 0.32, eyeY - eyeSize * 0.32, eyeSize * 0.44, 0, Math.PI * 2);
        ctx.arc(eyeSpacing - eyeSize * 0.28, eyeY + eyeSize * 0.28, eyeSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth: Tiny happy smiling mouth (:3 or happy open smile)
      const mouthY = eyeY + radius * 0.15;
      ctx.lineWidth = Math.max(1.4, radius * 0.05);
      ctx.strokeStyle = 'rgba(28, 12, 6, 0.92)';

      if (tier.face === 'open' || tier.face === 'happy' || tier.face === 'star') {
        // Cheerful open smile with sweet pink tongue!
        ctx.beginPath();
        ctx.arc(0, mouthY, radius * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.fillStyle = 'rgba(28, 12, 6, 0.92)';
        ctx.fill();
        ctx.stroke();

        // Cute rosy tongue inside
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(0, mouthY + radius * 0.04, radius * 0.08, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.fill();
      } else {
        // Adorable :3 cat mouth (two interconnected arcs)
        const catCurveR = radius * 0.06;
        ctx.beginPath();
        // Left lobe of :3
        ctx.arc(-catCurveR * 0.85, mouthY, catCurveR, 0, Math.PI * 0.95);
        // Right lobe of :3
        ctx.arc(catCurveR * 0.85, mouthY, catCurveR, Math.PI * 0.05, Math.PI);
        ctx.stroke();
      }
    }

    // Special cute Crown for Royal Milk Tea King (Tier 8 / index 7) - tilted on top!
    if (tier.tier === 7 && radius >= 45) {
      ctx.save();
      ctx.translate(0, -radius * 0.92);
      ctx.rotate(-0.16); // Playfully tilted golden crown!

      // Shiny golden gradient
      const crownGrad = ctx.createLinearGradient(0, -18, 0, 8);
      crownGrad.addColorStop(0, '#fef08a');
      crownGrad.addColorStop(0.45, '#f59e0b');
      crownGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = crownGrad;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(-16, 7);
      ctx.lineTo(-19, -8);
      ctx.lineTo(-7, -1);
      ctx.lineTo(0, -15);
      ctx.lineTo(7, -1);
      ctx.lineTo(19, -8);
      ctx.lineTo(16, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crown jewels (ruby & emerald dots)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -5, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(-10, -2, 2.2, 0, Math.PI * 2);
      ctx.arc(10, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Golden sparkle stars on crown peaks
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -15, 2.2, 0, Math.PI * 2);
      ctx.arc(-19, -8, 2, 0, Math.PI * 2);
      ctx.arc(19, -8, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      id="boba-cup-container"
      className="relative w-full flex-1 min-h-[380px] overflow-hidden flex flex-col items-center select-none cursor-pointer"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        id="boba-physics-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full block"
      />

      {/* Floating alert indicator when cup is near overflow */}
      {dangerWarning && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-full bg-red-500/90 text-white text-[11px] font-bold shadow-md animate-bounce flex items-center gap-1">
          <span>⚠️</span> Cup Penuh! Bahaya!
        </div>
      )}
    </div>
  );
};
