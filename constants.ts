
export const VIEW_WIDTH = 552; // Internal resolution width (scaled by CSS) - Multiple of 24
export const TILE_SIZE = 24;

// Physics Tuned for:
// Max Jump Height: 120px (5 tiles)
// Total Airtime: 600ms (0.6s)
// Formula: h = 1/2 * g * t_apex^2  => 120 = 0.5 * g * (0.3)^2 => g = 2666.67
// v0 = g * t_apex => 2666.67 * 0.3 = 800

export const GRAVITY = 2666; 
export const JUMP_FORCE = -800; 

export const MAX_SPEED = 320;
export const ACCEL_TIME = 0.096; // 96ms to max speed
export const DECEL_TIME = 0.048; // 48ms to stop

export const DASH_SPEED = 1050; // Snappier dash
export const WALL_SLIDE_SPEED = 150;
export const WALL_JUMP_X = 650; // Increased to 650 (approx 2.5 tiles with drag)
export const WALL_JUMP_Y = -750; // Slightly higher to match new gravity
export const DASH_TIME = 0.10; // Reduced duration to maintain ~105px distance

export const SPRING_SPEED_Y = -1350; // Increased to compensate for higher gravity (was -1050)
export const SPRING_SPEED_X = 1200;
export const SPRING_SIDE_LIFT = -450; 

// Colors
export const COLORS = {
  bg: '#1d1d2b',
  rock: '#5f574f',
  snow: '#fff1e8',
  ice: '#29adff',
  hairIdle: '#ff004d',
  hairDash: '#fff',
  hairNoDash: '#29adff',
  berry: '#ff004d',
  crystal: '#00e436',
  text: '#fff'
};

export const CHAPTERS = [
  { h: 0, c: [29, 29, 43] },
  { h: 1000, c: [46, 28, 43] },
  { h: 2000, c: [69, 25, 30] },
  { h: 3000, c: [78, 54, 68] },
  { h: 4000, c: [26, 26, 38] },
  { h: 5000, c: [28, 41, 56] },
  { h: 6000, c: [46, 64, 66] },
  { h: 9000, c: [13, 0, 28] }
];
