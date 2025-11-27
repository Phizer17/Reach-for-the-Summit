
import { VIEW_WIDTH, TILE_SIZE } from '../../constants';
import { Platform, Solid, Berry, Crystal, Spring } from '../../types';

export class LevelGenerator {
    spawnY: number = 0;
    lastSolidY: number = 0;
    lastWasCrystal: boolean = false;
    lastWasSpringUp: boolean = false;
    lastX: number = VIEW_WIDTH / 2;

    constructor() {
        this.reset();
    }

    reset() {
        this.spawnY = 150 - 80; 
        this.lastSolidY = 150;
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;
        this.lastX = VIEW_WIDTH / 2;
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

    isRegionFree(x: number, y: number, w: number, h: number, entities: any[], pad: number = 0): boolean {
        const r = { x: x - pad, y: y - pad, w: w + pad*2, h: h + pad*2 };
        for (const e of entities) {
            if (this.AABB(r, e)) return false;
        }
        return true;
    }

    checkSolidOverlap(x: number, y: number, w: number, h: number, solids: Solid[]) {
        const r = { x: x - 60, y: y - 60, w: w + 120, h: h + 120 };
        for (const s of solids) {
            if (this.AABB(r, s)) return true;
        }
        return false;
    }

    isSolidAt(x: number, y: number, solids: Solid[]): boolean {
        const checkX = x + TILE_SIZE / 2;
        const checkY = y + TILE_SIZE / 2;
        for (const s of solids) {
            if (checkX > s.x && checkX < s.x + s.w &&
                checkY > s.y && checkY < s.y + s.h) {
                return true;
            }
        }
        return false;
    }

    getReachableX(width: number, heightInMeters: number): number {
        // Dynamic horizontal reach based on difficulty
        // Under 500M: Very restricted horizontal jumps (easier)
        // Over 500M: Gradually widen
        let maxDist = 180; // Default max reach ~7.5 tiles
        if (heightInMeters < 500) {
            maxDist = 100; // ~4 tiles max horizontal jump for beginners
        } else if (heightInMeters < 1000) {
            maxDist = 140;
        }

        const minX = Math.max(0, this.lastX - maxDist);
        const maxX = Math.min(VIEW_WIDTH - width, this.lastX + maxDist);
        
        const range = maxX - minX;
        if (range <= 0) {
            // Fallback if squeezed against wall
            return this.lastX > VIEW_WIDTH / 2 ? Math.max(0, this.lastX - maxDist) : Math.min(VIEW_WIDTH - width, this.lastX + maxDist);
        }
        
        const x = minX + Math.random() * range;
        return Math.floor(x / TILE_SIZE) * TILE_SIZE;
    }

    generate(
        solids: Solid[], 
        platforms: Platform[], 
        crystals: Crystal[], 
        berries: Berry[], 
        springs: Spring[]
    ) {
        // Calculate current height in meters (approx)
        const currentHeightMeters = Math.abs(150 - this.spawnY) / TILE_SIZE;
        
        // Difficulty Scaling
        // 0 -> Easy, 1 -> Hard
        const difficultyFactor = Math.min(1, currentHeightMeters / 3000); 
        
        // Dynamic Gap Calculation
        let minGapTiles = 3;
        let maxGapTiles = 5;

        if (currentHeightMeters < 500) {
            // Tutorial / Easy Section
            minGapTiles = 3;
            maxGapTiles = 4;
        } else {
            // Progressive Difficulty
            minGapTiles = 4 + Math.floor(difficultyFactor * 2); 
            maxGapTiles = Math.min(9, 7 + Math.floor(difficultyFactor * 3)); 
        }
        
        let gapTiles = Math.floor(minGapTiles + Math.random() * (maxGapTiles - minGapTiles));
        let baseGap = gapTiles * TILE_SIZE;

        let potentialY = this.spawnY - baseGap;
        
        // Fix for Narrow Passages: Ensure the gap between the top of the previous structure
        // and the bottom of the new structure is at least 3 tiles (72px).
        // lastSolidY is the TOP of the previous structure.
        // potentialY will be the BOTTOM of the new structure.
        // The empty space is (lastSolidY - potentialY).
        if (this.lastSolidY - potentialY < TILE_SIZE * 3) {
            // Enforce minimum gap
            potentialY = this.lastSolidY - (TILE_SIZE * 3);
            baseGap = this.spawnY - potentialY;
        }

        if (this.lastWasSpringUp) {
            baseGap = Math.max(baseGap, 200 + Math.random() * 50);
            potentialY = this.spawnY - baseGap;
        } else if (this.lastWasCrystal) {
            if (baseGap > 180) {
                 baseGap = 120 + Math.random() * 40;
                 potentialY = this.spawnY - baseGap;
            }
        }
        
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;

        this.spawnY = potentialY;
        const currentY = this.spawnY;
        
        // --- 1. Crystal Generation (Increased Probability) ---
        let cChance = 0.18; // Increased from 0.1
        if (Math.random() < cChance) {
            const minX = 100;
            const maxX = VIEW_WIDTH - 100;
            const x = minX + Math.random() * (maxX - minX);
            const snappedX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
            
            // Crystal should not overlap solids or platforms
            if (this.isRegionFree(snappedX, currentY, 22, 22, solids) && 
                this.isRegionFree(snappedX, currentY, 22, 22, platforms)) {
                
                crystals.push({ x: snappedX + 1, y: currentY + 1, w: 22, h: 22, respawnTimer: 0 });
                this.lastWasCrystal = true;
                return;
            }
        }

        // --- 2. Solid Block Generation (Natural Terrain & Side Platforms) ---
        let solidChance = 0.75;
        
        if (Math.random() < solidChance) {
            // Core Block
            const maxW = Math.max(2, 5 - Math.floor(difficultyFactor * 3)); 
            const wTiles = 2 + Math.floor(Math.random() * (maxW - 1));
            let w = wTiles * TILE_SIZE;
            
            const x = this.getReachableX(w, currentHeightMeters);
            
            const maxH = Math.max(2, 6 - Math.floor(difficultyFactor * 3));
            const hTiles = 2 + Math.floor(Math.random() * (maxH - 1));
            let hS = hTiles * TILE_SIZE;
            
            solids.push({ x, y: currentY - hS, w, h: hS });
            this.lastSolidY = currentY - hS; // Record Top of this solid
            this.lastX = x + w / 2; 

            // NATURAL TERRAIN: "Floating Island" look
            // Add a smaller block underneath centered
            if (wTiles >= 3) {
                 const subW = (wTiles - 2) * TILE_SIZE;
                 const subX = x + TILE_SIZE;
                 const subH = TILE_SIZE; // 1 tile high support
                 solids.push({ x: subX, y: currentY, w: subW, h: subH });
            }

            // EDGE PLATFORMS: Prioritize extending edges with platforms
            // 70% chance to add platforms to the sides
            if (Math.random() < 0.7) {
                const addLeft = Math.random() > 0.5;
                const addRight = Math.random() > 0.5 || !addLeft; // Ensure at least one side often

                if (addRight) {
                     const platW = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                     const platX = x + w;
                     if (platX + platW < VIEW_WIDTH && this.isRegionFree(platX, currentY - hS, platW, 14, solids)) {
                         platforms.push({ x: platX, y: currentY - hS, w: platW, h: 14 });
                         this.lastX = platX + platW / 2; // Bias jump to platform
                     }
                }
                if (addLeft) {
                     const platW = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                     const platX = x - platW;
                     if (platX > 0 && this.isRegionFree(platX, currentY - hS, platW, 14, solids)) {
                         platforms.push({ x: platX, y: currentY - hS, w: platW, h: 14 });
                         // Only bias lastX if we didn't bias right
                         if (!addRight) this.lastX = platX + platW / 2;
                     }
                }
            }
            
            // Berry on Solid
            if (Math.random() > 0.6) { 
                if (Math.random() < 0.4) { 
                    const offset = Math.random() > 0.5 ? -70 : w + 40;
                    const berryX = x + offset;
                    const berryY = currentY - hS - 20 - Math.random() * 60; 
                    
                    if (berryX > 30 && berryX < VIEW_WIDTH - 30) {
                         // Strictly check berry position: Must be 24px away from any solid
                         if (this.isRegionFree(berryX, berryY, 30, 30, solids, 24) && 
                             this.isRegionFree(berryX, berryY, 30, 30, platforms, 24) &&
                             !this.checkSolidOverlap(berryX, berryY, 30, 30, crystals as any[])) {
                             
                             berries.push({ x: berryX, y: berryY, w: 30, h: 30, baseY: berryY, state: 0 });
                         }
                    }
                }
            }

            // Springs on Solids
            if (Math.random() < 0.15) {
                const springX = x + Math.floor(Math.random() * wTiles) * TILE_SIZE;
                const noLeft = !this.isSolidAt(springX - TILE_SIZE, currentY - hS, solids);
                const noRight = !this.isSolidAt(springX + TILE_SIZE, currentY - hS, solids);
                
                if (!this.isSolidAt(springX - TILE_SIZE, currentY - hS - TILE_SIZE, solids) && 
                    !this.isSolidAt(springX + TILE_SIZE, currentY - hS - TILE_SIZE, solids) &&
                    noLeft && noRight) {
                        springs.push({
                            x: springX, y: currentY - hS - TILE_SIZE, 
                            w: TILE_SIZE, h: TILE_SIZE, 
                            dir: 'up', animTimer: 0
                        });
                        this.lastWasSpringUp = true;
                }
            } 
            else if (Math.random() < 0.15) {
                const side = Math.random() > 0.5 ? 'right' : 'left';
                const springX = side === 'right' ? x + w : x - TILE_SIZE;
                const springY = (currentY - hS) + Math.floor(Math.random() * hTiles) * TILE_SIZE;
                
                let valid = false;
                if (side === 'right' && springX + TILE_SIZE > VIEW_WIDTH - 2) valid = false;
                else if (side === 'left' && springX < 2) valid = false;
                else if (springX >= 0 && springX < VIEW_WIDTH) {
                    if (this.isRegionFree(springX, springY, TILE_SIZE, TILE_SIZE, solids) &&
                        this.isRegionFree(springX, springY, TILE_SIZE, TILE_SIZE, platforms)) {
                        
                        if (side === 'right') {
                            if (this.isSolidAt(springX - TILE_SIZE, springY, solids)) valid = true;
                        } else {
                            if (this.isSolidAt(springX + TILE_SIZE, springY, solids)) valid = true;
                        }
                    }
                }

                if (valid) {
                    if (!this.isSolidAt(springX, springY - TILE_SIZE, solids) && !this.isSolidAt(springX, springY + TILE_SIZE, solids)) {
                        springs.push({
                            x: springX, y: springY,
                            w: TILE_SIZE, h: TILE_SIZE,
                            dir: side, animTimer: 0
                        });
                    }
                }
            }

            return;
        }

        // --- 3. One-way Platform Generation ---
        const wTiles = 3 + Math.floor(Math.random() * 3);
        const wP = wTiles * TILE_SIZE;
        const xP = this.getReachableX(wP, currentHeightMeters);
        
        if (this.isRegionFree(xP, currentY, wP, 14, solids) &&
            !this.checkSolidOverlap(xP, currentY, wP, TILE_SIZE, solids)) {
            
            platforms.push({ x: xP, y: currentY, w: wP, h: 14 });
            this.lastX = xP + wP / 2;
            
            if (Math.random() > 0.8) {
                 const bx = xP + wP / 2 - 15;
                 const by = currentY - 40;
                 if (this.isRegionFree(bx, by, 30, 30, solids, 24) &&
                     this.isRegionFree(bx, by, 30, 30, platforms, 24)) {
                     berries.push({ x: bx, y: by, w: 30, h: 30, baseY: by, state: 0 });
                 }
            }
        }
    }
}
