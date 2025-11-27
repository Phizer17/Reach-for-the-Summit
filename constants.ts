export const VIEW_WIDTH = 552; 
export const TILE_SIZE = 24;

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

export const SPRING_SPEED_Y = -1050; 
export const SPRING_SPEED_X = 2200; 
export const SPRING_SIDE_LIFT = -900; // Increased for parabolic arc (was -500)

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