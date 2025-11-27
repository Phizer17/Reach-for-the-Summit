
export const VIEW_WIDTH = 480; // Reduced to 20 tiles for better mobile visibility
export const TILE_SIZE = 24;

// Physics Tuned for:
// Max Jump Height: 120px (5 tiles)
export const GRAVITY = 2666; 
export const JUMP_FORCE = -800; 
export const MAX_FALL_SPEED = 900; 

export const MAX_SPEED = 320;
export const ACCEL_TIME = 0.096; 
export const DECEL_TIME = 0.048; 

export const DASH_SPEED = 1050; 
export const WALL_SLIDE_SPEED = 150;
export const WALL_JUMP_X = 650; 
export const WALL_JUMP_Y = -750; 
export const DASH_TIME = 0.10; 

// Parabolic Arc Tuning
export const SPRING_SPEED_Y = -1050; 
export const SPRING_SPEED_X = 750; // Increased to 750 for stronger push
export const SPRING_SIDE_LIFT = -900; // Increased lift for better arc

export const JUMP_BUFFER_TIME = 0.08; // 80ms

export const COLORS = {
  bg: '#1d1d2b',
  rock: '#5f574f',
  snow: '#fff1e8',
  ice: '#29adff',
  hairIdle: '#ff004d',
  hairDash: '#fff',
  hairNoDash: '#29adff',
  berry: '#ff2244', // Distinct bright red
  crystal: '#00e436',
  ghost: '#888888',
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