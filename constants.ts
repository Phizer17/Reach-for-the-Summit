
export const VIEW_WIDTH = 552; // Internal resolution width (scaled by CSS) - Multiple of 24
export const TILE_SIZE = 24;

export const GRAVITY = 1600;
export const DASH_SPEED = 750;
export const WALL_SLIDE_SPEED = 150;
export const WALL_JUMP_X = 440;
export const WALL_JUMP_Y = -680;
export const JUMP_FORCE = -680;
export const DASH_TIME = 0.14;

export const SPRING_SPEED_Y = -1050; // Slightly reduced from 1150
export const SPRING_SPEED_X = 1200;  // Stronger horizontal push
export const SPRING_SIDE_LIFT = -300; // Upward lift for side springs

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
