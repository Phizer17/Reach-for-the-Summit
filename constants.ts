export const VIEW_WIDTH = 480; // Reduced to 20 tiles for better mobile visibility
export const TILE_SIZE = 24;
export const GOAL_HEIGHT = 1000; // 1000M Goal for Time Attack

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

// Standard Wall Jump (Kick off) - RESTORED SMOOTH FEEL
export const WALL_JUMP_X = 520; 
export const WALL_JUMP_Y = -750; 

// Wall Bounce (Super Wall Jump / "Ceng Qiang Tiao") - TUNED
// High X velocity to clear distance quickly before air drag/input takes over
// 680px/s * 0.1s lock = ~68px initial burst + momentum carry
export const WALL_BOUNCE_X = 740; 
export const WALL_BOUNCE_Y = -920; 

export const DASH_TIME = 0.10; 

// Parabolic Arc Tuning
export const SPRING_SPEED_Y = -1050; 
export const SPRING_SPEED_X = 750; 
export const SPRING_SIDE_LIFT = -900; 

export const JUMP_BUFFER_TIME = 0.08; // 80ms

export const COLORS = {
  bg: '#1d1d2b',
  rock: '#5f574f',
  snow: '#fff1e8',
  ice: '#29adff',
  hairIdle: '#ff004d',
  hairDash: '#fff',
  hairNoDash: '#29adff',
  berry: '#ff2244', 
  crystal: '#00e436',
  ghost: '#888888',
  text: '#fff',
  flag: '#e74c3c' // Celeste Red for the Summit Flag
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