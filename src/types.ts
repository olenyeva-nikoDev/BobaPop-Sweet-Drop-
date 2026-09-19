export interface BobaTier {
  tier: number;
  name: string;
  subname: string;
  radius: number; // in pixels
  color: string;
  colorLight: string;
  colorDark: string;
  textColor: string;
  points: number;
  face: 'happy' | 'smile' | 'wink' | 'open' | 'star' | 'blush' | 'sparkle' | 'cool' | 'queen';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'star' | 'dot';
  rotation?: number;
  vRot?: number;
  wobbleSpeed?: number;
}

export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  text: string;
  multiplier?: number;
  alpha: number;
  scale: number;
  tierColor: string;
}

export interface ComboFloaty {
  id: number;
  x: number;
  y: number;
  text: string;
  multiplier: number;
  alpha: number;
  scale: number;
  rotation: number;
  life: number;
  maxLife: number;
  color: string;
}
