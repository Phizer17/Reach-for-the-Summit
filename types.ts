
export enum GameState {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  DYING = 'DYING',
  GAMEOVER = 'GAMEOVER'
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  sprite: boolean;
  frame: {
    faceDir: number;
    sx: number;
    sy: number;
  };
}

export interface PlayerState extends Rect {
  vx: number;
  vy: number;
  faceDir: number;
  grounded: boolean;
  canDash: boolean;
  isDashing: boolean;
  dashTimer: number;
  highestY: number;
  score: number;
  history: Point[];
  trail: TrailPoint[]; 
  flashTimer: number; 
  dashBuffer: number; 
  blinkTimer: number; // New: Eye blink timer
  moveTimer: number; // New: For acceleration curve (96ms)
}

export interface Platform extends Rect {}

export interface Solid extends Rect {}

export interface Spring extends Rect {
  dir: 'up' | 'left' | 'right';
  animTimer: number; 
}

export interface Berry extends Rect {
  baseY: number;
  state: 0 | 1 | 2; 
}

export interface Crystal extends Rect {
  respawnTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface AudioContextType extends AudioContext {
    createGain(): GainNode;
    createOscillator(): OscillatorNode;
}
