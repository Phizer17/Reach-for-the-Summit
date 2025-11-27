
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

    getReachableX(width: number): number {
        const maxDist = 250; 
        const minX = Math.max(0, this.lastX - maxDist);
        const maxX = Math.min(VIEW_WIDTH - width, this.lastX + maxDist);
        
        const range = maxX - minX;
        if (range <= 0) return this.lastX > VIEW_WIDTH / 2 ? VIEW_WIDTH - width : 0;
        
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
        const heightFactor = Math.min(1, Math.abs(this.spawnY) / 20000); 
        
        let minGapTiles = 4 + Math.floor(heightFactor * 2); 
        let maxGapTiles = Math.min(9, 7 + Math.floor(heightFactor * 3)); 
        
        let gapTiles = Math.floor(minGapTiles + Math.random() * (maxGapTiles - minGapTiles));
        let baseGap = gapTiles * TILE_SIZE;

        const potentialY = this.spawnY - baseGap;
        if (Math.abs(potentialY - this.lastSolidY) < TILE_SIZE * 3) {
            baseGap += TILE_SIZE * 2; 
        }

        if (this.lastWasSpringUp) {
            baseGap = 200 + Math.random() * 50;
        } else if (this.lastWasCrystal) {
            if (baseGap > 180) baseGap = 120 + Math.random() * 40;
        }
        
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;

        this.spawnY -= baseGap;
        const currentY = this.spawnY;
        
        // --- 1. Crystal Generation ---
        let cChance = 0.1;
        if (Math.random() < cChance) {
            const minX = 100;
            const maxX = VIEW_WIDTH - 100;
            const x = minX + Math.random() * (maxX - minX);
            const snappedX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
            
            if (!this.checkSolidOverlap(snappedX, currentY, 22, 22, solids)) {
                // Resize crystal to 22x22 (slightly smaller than tile)
                crystals.push({ x: snappedX + 1, y: currentY + 1, w: 22, h: 22, respawnTimer: 0 });
                this.lastWasCrystal = true;
                return;
            }
        }

        // --- 2. Solid Block Generation ---
        let solidChance = 0.75;
        
        if (Math.random() < solidChance) {
            const maxW = Math.max(2, 5 - Math.floor(heightFactor * 3)); 
            const wTiles = 2 + Math.floor(Math.random() * (maxW - 1));
            let w = wTiles * TILE_SIZE;
            
            const x = this.getReachableX(w);
            
            const maxH = Math.max(2, 6 - Math.floor(heightFactor * 3));
            const hTiles = 2 + Math.floor(Math.random() * (maxH - 1));
            let hS = hTiles * TILE_SIZE;
            
            solids.push({ x, y: currentY - hS, w, h: hS });
            this.lastSolidY = currentY - hS;
            this.lastX = x + w / 2; 
            
            // Berry on Solid (Reduced probability to 0.4)
            if (Math.random() > 0.6) { // Reduced check
                if (Math.random() < 0.4) { // effective 24% chance
                    // Ensure far reach placement
                    const offset = Math.random() > 0.5 ? -70 : w + 40;
                    const berryX = x + offset;
                    const berryY = currentY - hS - 20 - Math.random() * 60; 
                    
                    if (berryX > 30 && berryX < VIEW_WIDTH - 30) {
                         // Strict air check
                         if (!this.isSolidAt(berryX, berryY, solids) && !this.isSolidAt(berryX + 15, berryY + 15, solids)) {
                            berries.push({ x: berryX, y: berryY, w: 30, h: 30, baseY: berryY, state: 0 });
                         }
                    }
                }
            }

            // Attached Blocks (L-shapes)
            const growthSteps = Math.floor(Math.random() * 3);
            for(let i=0; i<growthSteps; i++) {
                const side = Math.random() > 0.5 ? 1 : -1;
                const subW = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                const subH = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                
                let subX = side === 1 ? x + w : x - subW;
                let subY = (currentY - hS) + Math.floor(Math.random() * (hTiles)) * TILE_SIZE;
                
                if (subX >= 0 && subX + subW <= VIEW_WIDTH) {
                    solids.push({ x: subX, y: subY, w: subW, h: subH });
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
                if (springX >= 0 && springX < VIEW_WIDTH) {
                    if (side === 'right') {
                        if (this.isSolidAt(springX - TILE_SIZE, springY, solids)) valid = true;
                    } else {
                        if (this.isSolidAt(springX + TILE_SIZE, springY, solids)) valid = true;
                    }
                }

                // Additional check: Ensure the spring is not inside another block
                if (valid && this.isSolidAt(springX, springY, solids)) valid = false;

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
        const xP = this.getReachableX(wP);
        
        if (!this.checkSolidOverlap(xP, currentY, wP, TILE_SIZE, solids)) {
            platforms.push({ x: xP, y: currentY, w: wP, h: 14 });
            this.lastX = xP + wP / 2;
            if (Math.random() > 0.8) {
                 berries.push({ x: xP + wP / 2 - 15, y: currentY - 40, w: 30, h: 30, baseY: currentY - 40, state: 0 });
            }
        }
    }
}
