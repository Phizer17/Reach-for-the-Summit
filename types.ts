
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
  flashTimer: number; // Visual flash when state restored
  dashBuffer: number; // Input buffering for dash
}

export interface Platform extends Rect {}

export interface Solid extends Rect {}

export interface Spring extends Rect {
  dir: 'up' | 'left' | 'right';
  animTimer: number; // 0 = idle, >0 = expanding/retracting
}

export interface Berry extends Rect {
  baseY: number;
  state: 0 | 1 | 2; // 0: Idle, 1: Following, 2: Collected
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
