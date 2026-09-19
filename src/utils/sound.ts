// Procedural Web Audio API Synthesizer & Mobile Haptics for BobaPop
// Zero external MP3 assets, 100% synthesized cozy audio

// Mobile Haptic Vibrations
export function triggerDropHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(18);
    } catch {
      // Haptics not supported or restricted in iframe
    }
  }
}

export function triggerMergeHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([25, 30, 45]);
    } catch {
      // Haptics not supported or restricted in iframe
    }
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    // Check localStorage for saved sound preference
    try {
      const saved = localStorage.getItem('bobapop_sound_muted');
      if (saved !== null) {
        this.isMuted = JSON.parse(saved);
      }
    } catch {
      this.isMuted = false;
    }
  }

  // Initialize and unlock Web Audio context cleanly upon first user interaction
  public unlockAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.isUnlocked = true;
    return this.ctx;
  }

  public toggleMute(): boolean {
    // Also unlock audio context on mute button toggle
    this.unlockAudio();
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('bobapop_sound_muted', JSON.stringify(this.isMuted));
    } catch {
      // ignore
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Drop Sound: Soft, satisfying water "bloop" or gentle bubble pop
   * Frequency sweep from low to mid followed by a warm decaying bubble resonance
   */
  public playDrop() {
    if (this.isMuted) return;
    try {
      const ctx = this.unlockAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Water "Bloop" / Bubble pitch sweep (220Hz -> 640Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Lowpass filter to keep it warm, bubbly, and never sharp
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.type = 'sine';
      // Quick upward frequency swoop creates the water droplet "bloop" sound
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.038);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.09);

      // Envelope: instant soft onset, short bubbly tail
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);

      // 2. Gentle bubble pop transient (soft high-mid click)
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(880, now);
      popOsc.frequency.exponentialRampToValueAtTime(1100, now + 0.02);

      popGain.gain.setValueAtTime(0.08, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);

      popOsc.start(now);
      popOsc.stop(now + 0.04);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Cheerful soft pop when next boba appears on dropper
   */
  public playPop() {
    if (this.isMuted) return;
    try {
      const ctx = this.unlockAudio();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.045);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Merge Sound: Bright, soothing Kalimba / Marimba musical notes.
   * As the tier gets bigger, plays higher harmonic pentatonic notes (warm, never harsh or piercing).
   */
  public playMerge(tierIndex: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.unlockAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Soothing Pentatonic Frequencies (Tiers 0 to 7):
      // Tier 0 (Brown Sugar): C4 (261.63)
      // Tier 1 (Taro): D4 (293.66)
      // Tier 2 (Matcha): E4 (329.63)
      // Tier 3 (Mango): G4 (392.00)
      // Tier 4 (Strawberry): A4 (440.00)
      // Tier 5 (Thai Tea): C5 (523.25)
      // Tier 6 (Honey Caramel): D5 (587.33)
      // Tier 7 (Royal Milk Tea King): E5 (659.25)
      const pentatonicScale = [
        261.63, // C4
        293.66, // D4
        329.63, // E4
        392.0,  // G4
        440.0,  // A4
        523.25, // C5
        587.33, // D5
        659.25, // E5
      ];

      const safeTier = Math.max(0, Math.min(tierIndex, pentatonicScale.length - 1));
      const fundFreq = pentatonicScale[safeTier];

      // Master warm filter to ensure notes are cozy and never piercing
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(2400, now);
      masterFilter.connect(ctx.destination);

      // --- Component 1: Warm Kalimba/Marimba Fundamental Bar Resonance ---
      const fundOsc = ctx.createOscillator();
      const fundGain = ctx.createGain();
      // Sine wave with rounded fundamental
      fundOsc.type = 'sine';
      fundOsc.frequency.setValueAtTime(fundFreq, now);

      fundGain.gain.setValueAtTime(0.001, now);
      fundGain.gain.linearRampToValueAtTime(0.28, now + 0.004); // Fast soft attack
      fundGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42); // Smooth resonant decay

      fundOsc.connect(fundGain);
      fundGain.connect(masterFilter);
      fundOsc.start(now);
      fundOsc.stop(now + 0.45);

      // --- Component 2: High Harmonic Tine Click (Kalimba metal/wood overtone) ---
      // Real Kalimbas have an overtone around ~3.8x to 4x that quickly damps in 40ms
      const tineOsc = ctx.createOscillator();
      const tineGain = ctx.createGain();
      tineOsc.type = 'triangle';
      tineOsc.frequency.setValueAtTime(fundFreq * 3.8, now);

      tineGain.gain.setValueAtTime(0.12, now);
      tineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      tineOsc.connect(tineGain);
      tineGain.connect(masterFilter);
      tineOsc.start(now);
      tineOsc.stop(now + 0.05);

      // --- Component 3: Warm Mallet Thump (Soft low strike impulse) ---
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(110, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(60, now + 0.025);

      thumpGain.gain.setValueAtTime(0.14, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(masterFilter);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.035);

      // --- Tier 7 Special: Royal Milk Tea King Celebration Shimmer Chord ---
      if (safeTier >= 7) {
        // Ethereal pentatonic triad arpeggio: G5 (783.99) and C6 (1046.50)
        const shimmerNotes = [783.99, 1046.5];
        shimmerNotes.forEach((freq, i) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          const sTime = now + 0.06 * (i + 1);

          sOsc.type = 'sine';
          sOsc.frequency.setValueAtTime(freq, sTime);

          sGain.gain.setValueAtTime(0.001, sTime);
          sGain.gain.linearRampToValueAtTime(0.18, sTime + 0.005);
          sGain.gain.exponentialRampToValueAtTime(0.001, sTime + 0.45);

          sOsc.connect(sGain);
          sGain.connect(masterFilter);

          sOsc.start(sTime);
          sOsc.stop(sTime + 0.48);
        });
      }
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Game Over Sound: Gentle, comforting lullaby tone
   * A soft, soothing music-box lullaby melody (5 notes descending in harmony)
   */
  public playGameOver() {
    if (this.isMuted) return;
    try {
      const ctx = this.unlockAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Comforting music-box lullaby notes: E5 -> D5 -> C5 -> A4 -> G4
      const lullabyNotes = [
        { freq: 659.25, time: 0.0 },   // E5
        { freq: 587.33, time: 0.16 },  // D5
        { freq: 523.25, time: 0.32 },  // C5
        { freq: 440.0,  time: 0.50 },  // A4
        { freq: 392.0,  time: 0.70 },  // G4 (comforting resolution)
      ];

      const lullabyFilter = ctx.createBiquadFilter();
      lullabyFilter.type = 'lowpass';
      lullabyFilter.frequency.setValueAtTime(1800, now);
      lullabyFilter.connect(ctx.destination);

      lullabyNotes.forEach(({ freq, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + time;

        // Music box bell timbre: pure sine with gentle overtone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.38);

        osc.connect(gain);
        gain.connect(lullabyFilter);

        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Celebratory fanfare for reaching Royal Milk Tea King or breaking records
   */
  public playCelebration() {
    if (this.isMuted) return;
    try {
      const ctx = this.unlockAudio();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.34);
      });
    } catch {
      // Audio fallback silent
    }
  }
}

export const soundManager = new SoundManager();

