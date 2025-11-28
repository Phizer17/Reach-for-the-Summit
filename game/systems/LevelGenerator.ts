import { VIEW_WIDTH, TILE_SIZE, GOAL_HEIGHT } from '../../constants';
import { Platform, Solid, Berry, Crystal, Spring, GameMode, Flag } from '../../types';

// --- ASCII MAP DEFINITIONS ---
// # : Solid
// = : Platform
// ^ : Spring Up
// < : Spring Left (Attached to Right Wall)
// > : Spring Right (Attached to Left Wall)
// * : Crystal
// @ : Berry
// . : Air

const PRESETS: Record<string, string[]> = {
    'CHIMNEY': [
        "#####...*...#####",
        "#####.......#####",
        "#####.......#####",
        "#####.......#####",
        "#####.......#####",
        "#####.......#####"
    ],
    'WALL_GAUNTLET': [
        "##.............##",
        "##.............##",
        "##.............##",
        "##......*......##",
        "##.............##",
        "##.............##"
    ],
    'DASH_CROSS': [
        "###...........###",
        "###.....*.....###",
        "###...........###"
    ],
    'STAIRS_RIGHT': [
        "##...............",
        "##...............",
        "..##.............",
        "..##.............",
        "....##...........",
        "....##...........",
        "......##.........",
        "......##........."
    ],
    'STAIRS_LEFT': [
        "...............##",
        "...............##",
        ".............##..",
        ".............##..",
        "...........##....",
        "...........##....",
        ".........##......",
        ".........##......"
    ],
    'FLOATING_ISLAND': [
        "........*........",
        ".................",
        "....==.....==....",
        "........#........",
        ".......###.......",
        "......#####......"
    ],
    'PYRAMID': [
        ".....##...##.....",
        "....###...###....",
        "...###..*..###...",
        "..###.......###..",
        ".###.........###.",
        "###...........###",
        "###...........###"
    ],
    'ARCH': [
        "#######...#######",
        "###...........###",
        "##.............##",
        "#.......*.......#",
        "#...............#",
        "#...====.====...#"
    ],
    'ZIGZAG': [
        "#######..........",
        "#######..........",
        "#######^.........",
        "#######..........", 
        "...........#####.",
        "...........#####.",
        ".....####........",
        ".....####........"
    ],
    'OVERHANG': [
        "#######...#######",
        "#######...#######",
        "#...............#",
        "#>.............<#", 
        "#...............#",
        "........*........"
    ],
    'FLOATING_WALL': [
        ".................",
        "........#........",
        "........#........",
        "........#........",
        "........#........",
        "........#........"
    ]
};

export class LevelGenerator {
    spawnY: number = 0;
    lastSolidY: number = 0;
    lastWasCrystal: boolean = false;
    lastWasSpringUp: boolean = false;
    lastX: number = VIEW_WIDTH / 2;
    goalSpawned: boolean = false;

    constructor() {
        this.reset();
    }

    reset() {
        this.spawnY = 150 - 80; 
        this.lastSolidY = 150;
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;
        this.lastX = VIEW_WIDTH / 2;
        this.goalSpawned = false;
    }

    initStartPlatform(solids: Solid[]) {
        solids.push({ x: -50, y: 150, w: VIEW_WIDTH + 100, h: 48 });
    }

    AABB(r1: any, r2: any, pad: number = 0) {
        return r1.x < r2.x + r2.w + pad &&
               r1.x + r1.w > r2.x - pad &&
               r1.y < r2.y + r2.h + pad &&
               r1.y + r1.h > r2.y - pad;
    }

    isRegionFree(x: number, y: number, w: number, h: number, entities: any[], pad: number = 0, ignoreEntity: any = null): boolean {
        const r = { x: x - pad, y: y - pad, w: w + pad*2, h: h + pad*2 };
        for (const e of entities) {
            if (e === ignoreEntity) continue;
            if (this.AABB(r, e)) return false;
        }
        return true;
    }

    getReachableX(width: number, heightInMeters: number, trySwitchSide: boolean = false): number {
        let maxDist = 200; 
        if (heightInMeters < 500) {
            maxDist = 120; 
        } else if (heightInMeters < 1000) {
            maxDist = 160;
        }

        if (trySwitchSide) {
            maxDist = 320; 
        }

        // 1. Basic Reachability Range
        const minX = Math.max(0, this.lastX - maxDist);
        const maxX = Math.min(VIEW_WIDTH - width, this.lastX + maxDist);
        
        // 2. Determine target X
        let x;
        if (trySwitchSide) {
             // Force jump across screen center
             if (this.lastX < VIEW_WIDTH / 2) {
                 // Switch Left -> Right
                 // Target range: [Center + 20, VIEW_WIDTH - width]
                 const start = (VIEW_WIDTH / 2) + 20;
                 const end = VIEW_WIDTH - width;
                 
                 if (end > start) {
                     x = start + Math.random() * (end - start);
                 } else {
                     x = VIEW_WIDTH - width; // Fallback to edge if object too big
                 }
             } else {
                 // Switch Right -> Left
                 // Target range: [0, Center - width - 20]
                 const start = 0;
                 const end = (VIEW_WIDTH / 2) - width - 20;
                 
                 if (end > start) {
                    x = start + Math.random() * (end - start);
                 } else {
                    x = 0; // Fallback
                 }
             }
        } else {
             // Standard constrained random
             const range = maxX - minX;
             if (range > 0) {
                 x = minX + Math.random() * range;
             } else {
                 // Fallback if constrained too tight
                 x = this.lastX > VIEW_WIDTH / 2 
                     ? Math.max(0, this.lastX - maxDist) 
                     : Math.min(VIEW_WIDTH - width, this.lastX + maxDist);
             }
        }

        // 3. HARD CLAMP to ensure we are NEVER out of bounds
        // This fixes the "terrain generated outside scene" bug
        return Math.max(0, Math.min(VIEW_WIDTH - width, x));
    }

    spawnBridgeIfNeeded(lastX: number, lastTopY: number, newX: number, newBottomY: number, crystals: Crystal[], springs: Spring[], solids: Solid[]) {
        const dist = Math.abs(lastX - newX);
        const vertGap = Math.abs(lastTopY - newBottomY);

        // Only spawn bridge if horizontal gap is significant
        if (dist > 160) { 
            const midX = (lastX + newX) / 2;
            const midY = (lastTopY + newBottomY) / 2; 
            
            // If the vertical gap is too small, a solid block will make it cramped.
            const canSpawnSolid = vertGap > 180; 

            if (!canSpawnSolid || Math.random() < 0.7) { 
                // 70% chance (or forced if tight gap): Floating Crystal
                this.trySpawnCrystal(midX - 11, midY, crystals, springs, solids);
            } else {
                 // 30% chance: Floating Island
                 const blockW = 48;
                 const blockH = 24;
                 const blockX = midX - blockW / 2;
                 const blockY = midY; 
                 
                 if (this.isRegionFree(blockX, blockY, blockW, blockH, springs, 24) && 
                     this.isRegionFree(blockX, blockY, blockW, blockH, crystals, 24) &&
                     this.isRegionFree(blockX, blockY, blockW, blockH, solids, 24)) {
                     const solid = { x: blockX, y: blockY, w: blockW, h: blockH };
                     solids.push(solid);
                     
                     // Chance to make bridge crumbling (20%)
                     if (Math.random() < 0.2) {
                         solid['crumbling'] = true;
                     }
                 }
            }
        }
    }

    trySpawnCrystal(x: number, y: number, crystals: Crystal[], springs: Spring[] = [], solids: Solid[] = []): boolean {
        for (const c of crystals) {
            const dx = c.x - x;
            const dy = c.y - y;
            if (Math.sqrt(dx*dx + dy*dy) < 120) return false;
        }
        for (const s of springs) {
            const dx = (s.x + s.w/2) - (x + 11);
            const dy = (s.y + s.h/2) - (y + 11);
            if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return false;
        }
        for (const s of solids) {
             const r = { x: x, y: y, w: 22, h: 22 };
             if (this.AABB(r, s)) return false;
        }
        crystals.push({ x, y, w: 22, h: 22, respawnTimer: 0 });
        return true;
    }

    spawnChunk(map: string[], gridX: number, gridY: number, solids: Solid[], platforms: Platform[], crystals: Crystal[], springs: Spring[], berries: Berry[], mirror: boolean = false) {
        const height = map.length;
        const width = map[0].length;
        const newSolids: Solid[] = [];

        for (let row = 0; row < height; row++) {
            let solidRunStart = -1;
            
            for (let col = 0; col < width; col++) {
                const actualCol = mirror ? width - 1 - col : col;
                const char = map[row][actualCol];

                const worldX = gridX + col * TILE_SIZE;
                const worldY = gridY + row * TILE_SIZE;

                if (char === '#') {
                    if (solidRunStart === -1) solidRunStart = col;
                } else {
                    if (solidRunStart !== -1) {
                        newSolids.push({
                            x: gridX + solidRunStart * TILE_SIZE,
                            y: gridY + row * TILE_SIZE,
                            w: (col - solidRunStart) * TILE_SIZE,
                            h: TILE_SIZE
                        });
                        solidRunStart = -1;
                    }
                }

                const centerX = worldX + TILE_SIZE / 2;
                const centerY = worldY + TILE_SIZE / 2;

                if (char === '=') {
                    platforms.push({ x: worldX, y: worldY, w: TILE_SIZE, h: 14 });
                } else if (char === '^') {
                    springs.push({ x: worldX, y: worldY, w: TILE_SIZE, h: TILE_SIZE, dir: 'up', animTimer: 0 });
                    if (row + 1 >= height || map[row+1][actualCol] !== '#') {
                         newSolids.push({ x: worldX, y: worldY + TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
                    }
                } else if (char === '<' || char === '>') {
                    let dir: 'left' | 'right' = (char === '<') ? 'left' : 'right';
                    if (mirror) {
                        dir = (dir === 'left') ? 'right' : 'left';
                    }
                    springs.push({ x: worldX, y: worldY, w: TILE_SIZE, h: TILE_SIZE, dir: dir, animTimer: 0 });
                    if (dir === 'left') {
                         if (col + 1 >= width || (mirror ? map[row][actualCol-1] : map[row][actualCol+1]) !== '#') {
                            newSolids.push({ x: worldX + TILE_SIZE, y: worldY, w: TILE_SIZE, h: TILE_SIZE });
                         }
                    } else {
                        if (col - 1 < 0 || (mirror ? map[row][actualCol+1] : map[row][actualCol-1]) !== '#') {
                            newSolids.push({ x: worldX - TILE_SIZE, y: worldY, w: TILE_SIZE, h: TILE_SIZE });
                        }
                    }
                } else if (char === '*') {
                    this.trySpawnCrystal(centerX - 11, centerY - 11, crystals, springs, solids.concat(newSolids));
                } else if (char === '@') {
                    berries.push({ x: centerX - 15, y: centerY - 15, w: 30, h: 30, baseY: centerY - 15, state: 0 });
                }
            }
            if (solidRunStart !== -1) {
                newSolids.push({
                    x: gridX + solidRunStart * TILE_SIZE,
                    y: gridY + row * TILE_SIZE,
                    w: (width - solidRunStart) * TILE_SIZE,
                    h: TILE_SIZE
                });
            }
        }
        solids.push(...newSolids);
        return { w: width * TILE_SIZE, h: height * TILE_SIZE, createdSolids: newSolids };
    }

    generate(solids: Solid[], platforms: Platform[], crystals: Crystal[], berries: Berry[], springs: Spring[], flags: Flag[], gameMode: GameMode) {
        if (this.goalSpawned) return;

        const currentHeightMeters = Math.abs(150 - this.spawnY) / TILE_SIZE;

        // CHECK GOAL CONDITION
        if (gameMode === GameMode.TIME_ATTACK && currentHeightMeters >= GOAL_HEIGHT) {
            // Spawn Goal Platform
            const gap = 120; // fixed gap
            const goalY = this.spawnY - gap;
            
            // Full width platform
            platforms.push({ x: 0, y: goalY, w: VIEW_WIDTH, h: 24 });
            
            // Flag
            flags.push({ x: VIEW_WIDTH/2 - 12, y: goalY - 48, w: 24, h: 48, reached: false });
            
            this.goalSpawned = true;
            this.spawnY = goalY;
            return;
        }

        const difficultyFactor = Math.min(1, currentHeightMeters / 4000); 

        // 1. DECIDE WHAT TO SPAWN (Standard or Preset)
        let techChance = 0.4 + (difficultyFactor * 0.4); 
        if (currentHeightMeters < 300) techChance = 0.15;
        const isPreset = Math.random() < techChance;

        // 2. DETERMINE OBJECT HEIGHT & GAP
        let objectHeight = 0;
        let map: string[] = [];
        let gapTiles = 0;
        let createdSolids: Solid[] = [];
        
        if (isPreset) {
            const keys = Object.keys(PRESETS);
            const mapKey = keys[Math.floor(Math.random() * keys.length)];
            map = PRESETS[mapKey];
            objectHeight = map.length * TILE_SIZE;
            
            // Presets get larger gaps
            const minGap = 5 + Math.floor(difficultyFactor * 2);
            const maxGap = 9 + Math.floor(difficultyFactor * 3);
            gapTiles = Math.floor(minGap + Math.random() * (maxGap - minGap));
        } else {
            objectHeight = TILE_SIZE * 2; 
            
            // Standard terrain gets SMALLER gaps (3-6 tiles) for tighter flow
            const minGap = 3 + Math.floor(difficultyFactor * 1.5);
            const maxGap = 5 + Math.floor(difficultyFactor * 2); 
            gapTiles = Math.floor(minGap + Math.random() * (maxGap - minGap));
        }

        const gapPx = gapTiles * TILE_SIZE;

        // 3. CALCULATE NEW POSITION
        const nextBottomY = this.lastSolidY - gapPx;
        const nextTopY = nextBottomY - objectHeight;

        this.spawnY = nextTopY;
        const currentY = nextTopY;
        
        const trySwitchSide = Math.random() < (0.4 + difficultyFactor * 0.2);

        // 4. SPAWN IT
        let nextSolidTopY = currentY; 
        let nextX = this.lastX;

        if (isPreset) {
            // PRESET GENERATION
            const mapW = map[0].length * TILE_SIZE;
            const x = this.getReachableX(mapW, currentHeightMeters, trySwitchSide);
            const mirror = Math.random() < 0.5;

            const result = this.spawnChunk(map, x, currentY, solids, platforms, crystals, springs, berries, mirror);
            createdSolids = result.createdSolids;

            this.spawnBridgeIfNeeded(this.lastX, this.lastSolidY, x + mapW/2, nextBottomY, crystals, springs, solids);

            nextSolidTopY = currentY; 
            nextX = x + mapW / 2;

        } else {
            // STANDARD PLATFORM GENERATION
            const wTiles = 3 + Math.floor(Math.random() * 4); 
            const wP = wTiles * TILE_SIZE;
            const xP = this.getReachableX(wP, currentHeightMeters, trySwitchSide);
            
            if (Math.random() < 0.6) {
                platforms.push({ x: xP, y: currentY, w: wP, h: 14 });
                nextSolidTopY = currentY; 
                this.spawnBridgeIfNeeded(this.lastX, this.lastSolidY, xP + wP/2, nextBottomY, crystals, springs, solids);

            } else {
                const s = { x: xP, y: currentY, w: wP, h: TILE_SIZE * 2 };
                solids.push(s);
                createdSolids.push(s);

                nextSolidTopY = currentY;
                
                if (Math.random() < 0.25) {
                    const validW = wP - 48; 
                    if (validW > 0) {
                        const sX = xP + 24 + Math.floor(Math.random() * validW / 12) * 12;
                        if (this.isRegionFree(sX, currentY - 24, 24, 24, crystals) &&
                            this.isRegionFree(sX, currentY - 24, 24, 24, springs)) {
                                springs.push({ x: sX, y: currentY - 24, w: 24, h: 24, dir: 'up', animTimer: 0 });
                        }
                    }
                }
                if (Math.random() < 0.15) {
                     const side = xP > VIEW_WIDTH/2 ? 'left' : 'right';
                     const spX = side === 'left' ? xP - TILE_SIZE : xP + wP;
                     if (spX > TILE_SIZE && spX < VIEW_WIDTH - TILE_SIZE * 2) {
                         if (this.isRegionFree(spX, currentY + 12, 24, 24, crystals) &&
                             this.isRegionFree(spX, currentY + 12, 24, 24, springs)) {
                                 springs.push({ x: spX, y: currentY + 12, w: TILE_SIZE, h: TILE_SIZE, dir: side, animTimer: 0 });
                         }
                     }
                }
                this.spawnBridgeIfNeeded(this.lastX, this.lastSolidY, xP + wP/2, nextBottomY, crystals, springs, solids);
            }
            nextX = xP + wP / 2;
        }

        if (createdSolids.length > 0) {
             if (Math.random() < 0.1) {
                 createdSolids.forEach(s => {
                     s.crumbling = true;
                 });
             }
        }

        this.lastSolidY = nextSolidTopY;
        this.lastX = nextX;
    }
}