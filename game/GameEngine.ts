
import { GameState, Rect, Platform, Berry, Crystal, Solid, Particle, Spring } from '../types';
import { COLORS, CHAPTERS, VIEW_WIDTH, TILE_SIZE, GRAVITY, DASH_SPEED, WALL_SLIDE_SPEED, WALL_JUMP_X, WALL_JUMP_Y, JUMP_FORCE, DASH_TIME, SPRING_SPEED_Y, SPRING_SPEED_X, SPRING_SIDE_LIFT } from '../constants';
import { sfx } from '../services/audioService';

export class GameEngine {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    state: GameState = GameState.TITLE;
    
    // Viewport
    viewHeight: number = 0;
    cameraY: number = 0;
    
    // Input State
    lastInputDir: number = 0;
    
    // Assets
    tilesetImg: HTMLImageElement | null = null;
    platformImg: HTMLImageElement | null = null;
    bgImg: HTMLImageElement | null = null;
    springImg: HTMLImageElement | null = null;
    
    // Generation State
    lastWasCrystal: boolean = false;
    lastWasSpringUp: boolean = false;
    
    // Entities
    player = {
        x: 0, y: 0, w: 24, h: 24, vx: 0, vy: 0,
        faceDir: 1, grounded: false, canDash: true, isDashing: false,
        dashTimer: 0, dashDx: 0, dashDy: 0,
        highestY: 0, score: 0,
        trail: [] as any[], history: [] as any[], followingBerries: [] as Berry[],
        sx: 1, sy: 1, jumpBuffer: 0, coyoteTimer: 0, wallJumpTimer: 0, onWall: 0,
        settleTimer: 0, settleStreak: 0,
        lastMilestone: 0,
        wallBounceTimer: 0,
        flashTimer: 0,
        dashBuffer: 0, 
        hasTriggeredRecord: false
    };
    
    platforms: Platform[] = [];
    solids: Solid[] = [];
    berries: Berry[] = [];
    crystals: Crystal[] = [];
    springs: Spring[] = [];
    particles: Particle[] = [];
    snow: any[] = [];
    ripples: any[] = [];
    
    // State
    shake = 0;
    hitStop = 0;
    spawnY = 0;
    currentBg = [29, 29, 43];
    targetBg = [29, 29, 43];
    lastMilestone = 0;
    highScore = 0;
    
    deathRipple = {
        active: false,
        x: 0,
        y: 0,
        r: 0,
        maxR: 0,
        color: '#fff'
    };
    
    // Callbacks to React
    onScoreUpdate: (height: number, berries: number, isRecord: boolean) => void;
    onGameOver: (height: number, berries: number, newRecord: boolean) => void;
    onMilestone: (text: string, isRecord: boolean) => void;
    
    constructor(
        canvas: HTMLCanvasElement, 
        onScore: (h: number, b: number, rec: boolean) => void,
        onOver: (h: number, b: number, rec: boolean) => void,
        onMile: (t: string, rec: boolean) => void
    ) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false; 
        
        this.onScoreUpdate = onScore;
        this.onGameOver = onOver;
        this.onMilestone = onMile;
        
        const saved = localStorage.getItem('dc_highscore');
        this.highScore = saved ? parseInt(saved) : 0;
        
        this.resize();
        this.loadTextures();
        this.initSnow();
    }

    resize() {
        this.canvas.width = VIEW_WIDTH;
        this.canvas.height = this.canvas.clientHeight * (VIEW_WIDTH / this.canvas.clientWidth);
        this.viewHeight = this.canvas.height;
        if(this.ctx) this.ctx.imageSmoothingEnabled = false;
    }

    vibrate(ms: number) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    loadTextures() {
        // --- TILESET ATLAS (96x72) ---
        const c = {
            base: '#201c3b',      
            mid: '#332c50',       
            light: '#68c2d3',     
            shadow: '#110d21',    
            snow: '#ffffff',      
            snowShade: '#8daac9'  
        };

        const tilesetSvg = `
        <svg width="96" height="72" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="rockPat" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                    <rect width="24" height="24" fill="${c.base}"/>
                    <path d="M0 24 L24 0" stroke="${c.mid}" stroke-width="6"/>
                    <path d="M-12 24 L12 0" stroke="${c.mid}" stroke-width="6"/>
                    <path d="M12 24 L36 0" stroke="${c.mid}" stroke-width="6"/>
                    <rect x="6" y="14" width="2" height="2" fill="${c.light}" opacity="0.3"/>
                    <rect x="16" y="4" width="2" height="2" fill="${c.light}" opacity="0.3"/>
                </pattern>
            </defs>
            <rect width="96" height="72" fill="url(#rockPat)"/>
            <g>
                <rect x="0" y="0" width="2" height="72" fill="${c.light}"/>
                <rect x="2" y="0" width="2" height="72" fill="${c.mid}" opacity="0.5"/>
                <rect x="0" y="10" width="2" height="4" fill="${c.base}"/> 
                <rect x="0" y="40" width="2" height="2" fill="${c.base}"/> 
            </g>
            <g transform="translate(48, 0)">
                <rect x="22" y="0" width="2" height="72" fill="${c.shadow}"/>
                <rect x="20" y="0" width="2" height="72" fill="${c.shadow}" opacity="0.5"/>
            </g>
            <g transform="translate(72, 0)">
                <rect x="0" y="0" width="2" height="72" fill="${c.light}"/>
                <rect x="22" y="0" width="2" height="72" fill="${c.shadow}"/>
            </g>
            <g>
                <rect x="0" y="0" width="96" height="6" fill="${c.snow}"/>
                <rect x="0" y="6" width="96" height="2" fill="${c.snowShade}"/>
                <path d="M4 8 H8 V10 H4 Z" fill="${c.snow}"/>
                <path d="M20 8 H26 V11 H20 Z" fill="${c.snow}"/>
                <path d="M44 8 H48 V9 H44 Z" fill="${c.snow}"/>
                <path d="M60 8 H66 V12 H60 Z" fill="${c.snow}"/>
                <path d="M85 8 H88 V10 H85 Z" fill="${c.snow}"/>
                <rect x="0" y="0" width="2" height="6" fill="${c.snow}"/>
                <rect x="94" y="0" width="2" height="6" fill="${c.snow}"/>
            </g>
            <g transform="translate(0, 48)">
                <rect x="0" y="22" width="96" height="2" fill="${c.shadow}"/>
                <rect x="0" y="20" width="96" height="2" fill="${c.shadow}" opacity="0.5"/>
            </g>
        </svg>`.trim();
        
        this.tilesetImg = new Image();
        this.tilesetImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(tilesetSvg);

        // --- PLATFORM ---
        const platformSvg = `
        <svg width="24" height="14" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="2" width="24" height="8" fill="#5c4436"/>
            <rect x="0" y="2" width="24" height="2" fill="#82604d"/> 
            <rect x="0" y="9" width="24" height="1" fill="#33251d"/> 
            <rect x="4" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/>
            <rect x="18" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/>
            <rect x="0" y="0" width="24" height="3" fill="#e8f7ff"/>
        </svg>`.trim();

        this.platformImg = new Image();
        this.platformImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(platformSvg);

        // --- SPRING ---
        const springSvg = `
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <!-- Base -->
            <rect x="2" y="18" width="20" height="6" rx="2" fill="#555"/>
            <rect x="3" y="19" width="18" height="4" fill="#333"/>
            <!-- Coils -->
            <path d="M4 18 L20 18 L4 14 L20 14 L4 10" stroke="#ccc" stroke-width="3" fill="none" stroke-linecap="round"/>
            <!-- Top Plate -->
            <rect x="2" y="8" width="20" height="4" rx="1" fill="#e04040"/>
            <rect x="4" y="9" width="16" height="2" fill="#ff6666"/>
        </svg>`.trim();
        
        this.springImg = new Image();
        this.springImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(springSvg);

        // --- BACKGROUND ---
        const bgSvg = `
        <svg width="552" height="960" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#111221"/>
                    <stop offset="100%" stop-color="#282638"/>
                </linearGradient>
            </defs>
            <rect width="552" height="960" fill="url(#sky)"/>
            <path d="M0 960 L0 800 L100 700 L250 850 L400 720 L552 800 L552 960 Z" fill="#1b1b29"/>
            <g fill="#fff" opacity="0.4">
                <circle cx="50" cy="100" r="1"/><circle cx="200" cy="50" r="1.5"/>
                <circle cx="450" cy="150" r="1"/><circle cx="300" cy="300" r="1"/>
                <circle cx="100" cy="400" r="1"/>
            </g>
        </svg>`.trim();

        this.bgImg = new Image();
        this.bgImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(bgSvg);
    }

    initGame() {
        this.platforms = [];
        this.berries = [];
        this.crystals = [];
        this.solids = [];
        this.springs = [];
        this.particles = [];
        this.ripples = [];
        
        // Ground: Optimized size to prevent lag (reduced from 400)
        this.solids.push({ x: -50, y: 150, w: VIEW_WIDTH + 100, h: 48 });
        
        this.spawnY = 0;
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;
        
        this.player.x = VIEW_WIDTH / 2 - 12;
        this.player.y = -50; 
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.canDash = true;
        this.player.isDashing = false;
        this.player.grounded = false;
        this.player.highestY = 0;
        this.player.score = 0;
        this.player.followingBerries = [];
        this.player.history = [];
        this.player.lastMilestone = 0;
        this.player.wallBounceTimer = 0;
        this.player.flashTimer = 0;
        this.player.dashBuffer = 0;
        this.player.hasTriggeredRecord = false;
        this.lastMilestone = 0;
        
        this.deathRipple.active = false;
        this.cameraY = -this.viewHeight / 2;
        this.state = GameState.PLAYING;
        this.currentBg = [...this.targetBg];
        this.setChapter(0);
        
        for (let i = 0; i < 10; i++) this.generateMap();
        
        this.onScoreUpdate(0, 0, false);
    }

    setChapter(h: number) {
        let idx = 0;
        for (let i = 0; i < CHAPTERS.length; i++) {
            if (h >= CHAPTERS[i].h) idx = i;
        }
        this.targetBg = CHAPTERS[idx].c;
    }

    AABB(r1: Rect, r2: Rect, pad: number = 0) {
        return r1.x < r2.x + r2.w + pad &&
               r1.x + r1.w > r2.x - pad &&
               r1.y < r2.y + r2.h + pad &&
               r1.y + r1.h > r2.y - pad;
    }

    isSolidAt(x: number, y: number): boolean {
        const checkX = x + TILE_SIZE / 2;
        const checkY = y + TILE_SIZE / 2;
        for (const s of this.solids) {
            if (checkX > s.x && checkX < s.x + s.w &&
                checkY > s.y && checkY < s.y + s.h) {
                return true;
            }
        }
        return false;
    }

    generateMap() {
        const heightFactor = Math.min(1, Math.abs(this.spawnY) / 20000); 
        
        let minGapTiles = 4 + Math.floor(heightFactor * 2); 
        let maxGapTiles = 7 + Math.floor(heightFactor * 3); 
        
        let gapTiles = Math.floor(minGapTiles + Math.random() * (maxGapTiles - minGapTiles));
        let baseGap = gapTiles * TILE_SIZE;

        if (this.lastWasSpringUp) {
            baseGap = 200 + Math.random() * 50;
        } else if (this.lastWasCrystal) {
            if (baseGap > 140) baseGap = 100 + Math.random() * 30;
        }
        
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;

        this.spawnY -= baseGap;
        const currentY = this.spawnY;
        
        // --- CRYSTALS ---
        let cChance = 0.1;
        if (Math.random() < cChance) {
            const maxCol = Math.floor((VIEW_WIDTH - 48) / TILE_SIZE);
            const col = 2 + Math.floor(Math.random() * (maxCol - 2));
            const x = col * TILE_SIZE;
            if (!this.checkSolidOverlap(x, currentY, 30, 30)) {
                this.crystals.push({ x: x - 3, y: currentY - 3, w: 30, h: 30, respawnTimer: 0 });
                this.lastWasCrystal = true;
                return;
            }
        }

        // --- SOLIDS ---
        let solidChance = 0.75;
        
        if (Math.random() < solidChance) {
            const totalCols = Math.floor(VIEW_WIDTH / TILE_SIZE);
            const col = Math.floor(Math.random() * (totalCols - 2));
            const x = col * TILE_SIZE;
            
            const maxW = Math.max(2, 5 - Math.floor(heightFactor * 3)); 
            const wTiles = 2 + Math.floor(Math.random() * (maxW - 1));
            let w = wTiles * TILE_SIZE;
            if (x + w > VIEW_WIDTH) w = VIEW_WIDTH - x;
            
            const maxH = Math.max(2, 6 - Math.floor(heightFactor * 3));
            const hTiles = 2 + Math.floor(Math.random() * (maxH - 1));
            let hS = hTiles * TILE_SIZE;
            
            this.solids.push({ x, y: currentY - hS, w, h: hS });
            
            const growthSteps = Math.floor(Math.random() * 3);
            for(let i=0; i<growthSteps; i++) {
                const side = Math.random() > 0.5 ? 1 : -1;
                const subW = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                const subH = (1 + Math.floor(Math.random() * 2)) * TILE_SIZE;
                
                let subX = side === 1 ? x + w : x - subW;
                let subY = (currentY - hS) + Math.floor(Math.random() * (hTiles)) * TILE_SIZE;
                
                if (subX >= 0 && subX + subW <= VIEW_WIDTH) {
                    this.solids.push({ x: subX, y: subY, w: subW, h: subH });
                }
            }

            // --- SPRING GENERATION ---
            if (Math.random() < 0.15) {
                const springX = x + Math.floor(Math.random() * wTiles) * TILE_SIZE;
                // Prevent spawning in tight gaps
                if (!this.isSolidAt(springX - TILE_SIZE, currentY - hS - TILE_SIZE) && 
                    !this.isSolidAt(springX + TILE_SIZE, currentY - hS - TILE_SIZE)) {
                        this.springs.push({
                            x: springX, y: currentY - hS - TILE_SIZE, 
                            w: TILE_SIZE, h: TILE_SIZE, 
                            dir: 'up', animTimer: 0
                        });
                        this.lastWasSpringUp = true;
                }
            } 
            else if (Math.random() < 0.15) {
                const side = Math.random() > 0.5 ? 'right' : 'left';
                // FIX: Ensure spring is attached to the OUTER side of the block
                // If Side is Right (pushes right), it must be on the RIGHT edge of a block located to its LEFT.
                // x is block left edge. x+w is block right edge.
                // Side Right Spring: x = block.x + block.w. 
                
                const springX = side === 'right' ? x + w : x - TILE_SIZE;
                const springY = (currentY - hS) + Math.floor(Math.random() * hTiles) * TILE_SIZE;
                
                // Check valid placement
                let valid = false;
                if (springX >= 0 && springX < VIEW_WIDTH) {
                    if (side === 'right') {
                        // Spring at x+w. Needs block at left (x+w-TILE_SIZE)
                        if (!this.isSolidAt(springX + TILE_SIZE, springY)) valid = true;
                    } else {
                        // Spring at x-TILE. Needs block at right (x)
                        if (!this.isSolidAt(springX - TILE_SIZE, springY)) valid = true;
                    }
                }

                if (valid) {
                    // Safety check vertical neighbors for 1-gap
                    if (!this.isSolidAt(springX, springY - TILE_SIZE) && !this.isSolidAt(springX, springY + TILE_SIZE)) {
                        this.springs.push({
                            x: springX, y: springY,
                            w: TILE_SIZE, h: TILE_SIZE,
                            dir: side, animTimer: 0
                        });
                    }
                }
            }

            return;
        }

        const hasBerry = Math.random() > 0.85;
        const wTiles = hasBerry ? 3 : 4 + Math.floor(Math.random() * 3);
        const wP = wTiles * TILE_SIZE;
        const maxCol = Math.floor((VIEW_WIDTH - wP) / TILE_SIZE);
        const col = Math.floor(Math.random() * maxCol);
        const xP = col * TILE_SIZE;
        
        if (!this.checkSolidOverlap(xP, currentY, wP, TILE_SIZE)) {
            this.platforms.push({ x: xP, y: currentY, w: wP, h: 14 });
            if (hasBerry) {
                this.berries.push({ x: xP + wP / 2 - 15, y: currentY - 40, w: 30, h: 30, baseY: currentY - 40, state: 0 });
            }
        }
    }

    checkSolidOverlap(x: number, y: number, w: number, h: number) {
        const r = { x: x - 60, y: y - 60, w: w + 120, h: h + 120 };
        for (const s of this.solids) {
            if (this.AABB(r, s)) return true;
        }
        return false;
    }
    
    initSnow() {
        this.snow = [];
        for (let i = 0; i < 50; i++) {
            this.snow.push({
                x: Math.random() * VIEW_WIDTH,
                y: Math.random() * this.viewHeight,
                vx: (Math.random() - 0.5) * 40,
                vy: 30 + Math.random() * 60,
                size: Math.random() * 2 + 1
            });
        }
    }

    updateSnow(dt: number) {
        const camBottom = this.cameraY + this.viewHeight;
        this.snow.forEach(s => {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.y > camBottom) {
                s.y = this.cameraY - 10;
                s.x = Math.random() * VIEW_WIDTH;
            }
            if (s.x > VIEW_WIDTH) s.x = 0;
            if (s.x < 0) s.x = VIEW_WIDTH;
        });
    }

    checkBounds() {
        const p = this.player;
        if (p.x < 0) { p.x = 0; p.vx = 0; }
        if (p.x + p.w > VIEW_WIDTH) { p.x = VIEW_WIDTH - p.w; p.vx = 0; }
    }

    resolveSolidsX() {
        const p = this.player;
        // FIX: Reduce bottom of hitbox by 6px for X collision
        // This allows the player to "step up" small seams without getting stopped
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h - 6 };
        
        for (const s of this.solids) {
            if (this.AABB(rect, s)) {
                if (p.vx > 0) {
                    p.x = s.x - p.w;
                    p.vx = 0;
                } else if (p.vx < 0) {
                    p.x = s.x + s.w;
                    p.vx = 0;
                }
            }
        }
    }

    checkPlatformCollisions() {
        const p = this.player;
        if (p.vy < 0) return;
        
        for (const pl of this.platforms) {
            if (p.x + p.w > pl.x && p.x < pl.x + pl.w) {
                if (p.y + p.h >= pl.y && p.y + p.h <= pl.y + 10) {
                    p.y = pl.y - p.h;
                    p.vy = 0;
                    p.grounded = true;
                }
            }
        }
    }

    checkSpringCollisions() {
        const p = this.player;
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        
        for (const s of this.springs) {
            if (this.AABB(rect, { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 12 })) {
                sfx.play('spring');
                this.vibrate(30); // Haptic
                s.animTimer = 0.2;
                
                // Restore State
                p.canDash = true; 
                p.isDashing = false;
                p.dashTimer = 0;
                p.flashTimer = 0.1; 
                
                if (s.dir === 'up') {
                    p.vy = SPRING_SPEED_Y;
                    p.sx = 0.5; p.sy = 1.5; 
                } else if (s.dir === 'left') {
                    p.vx = -SPRING_SPEED_X;
                    p.vy = SPRING_SIDE_LIFT; 
                    p.faceDir = -1;
                    p.sx = 1.5; p.sy = 0.5; 
                } else if (s.dir === 'right') {
                    p.vx = SPRING_SPEED_X;
                    p.vy = SPRING_SIDE_LIFT;
                    p.faceDir = 1;
                    p.sx = 1.5; p.sy = 0.5;
                }
                
                this.spawnEffect(s.x + 12, s.y + 12, '#fff', 5);
            }
        }
    }

    checkEntityCollisions() {
        const p = this.player;
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        
        // Crystals
        for (const c of this.crystals) {
            if (c.respawnTimer <= 0 && this.AABB(rect, c)) {
                const dashQueued = p.dashBuffer > 0;
                if (!p.canDash || dashQueued) {
                    p.canDash = true;
                    c.respawnTimer = 2.5;
                    sfx.play('crystal');
                    this.vibrate(50); // Haptic
                    this.hitStop = 0.05;
                    this.shake = 4;
                    p.flashTimer = 0.1;
                    this.spawnEffect(c.x + 15, c.y + 15, COLORS.crystal, 5);
                }
            }
        }

        // Berries
        for (const b of this.berries) {
            if (b.state === 0 && this.AABB(rect, b)) {
                b.state = 1;
                p.followingBerries.push(b);
                sfx.play('berry', p.followingBerries.length); 
            }
        }
        
        this.checkSpringCollisions();
    }

    checkWallAdjacency() {
        const p = this.player;
        p.onWall = 0;
        const left = { x: p.x - 2, y: p.y + 4, w: 2, h: p.h - 8 };
        const right = { x: p.x + p.w, y: p.y + 4, w: 2, h: p.h - 8 };
        
        for (const s of this.solids) {
            if (this.AABB(left, s)) { p.onWall = -1; break; }
        }
        if (p.onWall === 0) {
            for (const s of this.solids) {
                if (this.AABB(right, s)) { p.onWall = 1; break; }
            }
        }
    }

    spawnRipple(x: number, y: number) {
        this.ripples.push({ x, y, r: 5, alpha: 1 });
    }

    spawnEffect(x: number, y: number, c: string, n: number = 8) {
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1,
                color: c,
                size: Math.random() * 5 + 3
            });
        }
    }

    update(dt: number, input: { dir: number, jump: boolean, dash: boolean }) {
        for (let i = 0; i < 3; i++) {
            this.currentBg[i] += (this.targetBg[i] - this.currentBg[i]) * 2 * dt;
        }
        
        if (this.state === GameState.TITLE) {
             this.updateSnow(dt);
             return;
        }

        if (this.state === GameState.DYING) {
            if (this.deathRipple.active) {
                const targetR = this.deathRipple.maxR * 1.2;
                this.deathRipple.r += (targetR - this.deathRipple.r) * 5 * dt;
                
                if (this.deathRipple.r > targetR - 10) {
                     const p = this.player;
                     if (this.deathRipple.active) {
                         this.onGameOver(p.highestY, p.score, p.highestY > this.highScore);
                     }
                }
            }
            return;
        }

        if (this.hitStop > 0) {
            this.hitStop -= dt;
            if (this.hitStop > 0) return; 
            dt = 0.016;
        }

        const p = this.player;
        const wasGrounded = p.grounded;
        this.lastInputDir = input.dir; 

        this.updateSnow(dt);

        if(p.flashTimer > 0) p.flashTimer -= dt;
        if(p.dashBuffer > 0) p.dashBuffer -= dt;

        if (input.dash && !p.canDash) {
            p.dashBuffer = 0.08; 
        }

        const targetY = p.y - this.viewHeight * 0.45;
        if (targetY < this.cameraY) {
            this.cameraY += (targetY - this.cameraY) * 0.15;
        }

        const h = Math.floor(Math.abs(p.y) / 10);
        const isRecord = this.highScore > 0 && h > this.highScore;
        if (h > p.highestY) {
            p.highestY = h;
            this.onScoreUpdate(h, p.score, isRecord);
            if (isRecord && !p.hasTriggeredRecord && h < this.highScore + 50) {
                 this.onMilestone("NEW RECORD!!", true);
                 p.hasTriggeredRecord = true;
            }
            if (h >= p.lastMilestone + 1000) {
                p.lastMilestone = Math.floor(h / 1000) * 1000;
                this.onMilestone(p.lastMilestone + "m", false);
                this.setChapter(p.lastMilestone);
            }
        }

        if (p.y > this.cameraY + this.viewHeight + 100) {
            this.die();
            return;
        }

        if (p.grounded) p.coyoteTimer = 0.1; else p.coyoteTimer -= dt;
        if (input.jump) p.jumpBuffer = 0.15;
        if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
        if (p.wallJumpTimer > 0) p.wallJumpTimer -= dt;

        this.springs.forEach(s => {
            if (s.animTimer > 0) s.animTimer -= dt;
        });

        if (p.isDashing && p.dashDx === 0 && p.dashDy === -1) {
            p.wallBounceTimer = 0.08; 
        } else {
            p.wallBounceTimer -= dt;
        }

        // --- PHYSICS SUB-STEPPING ---
        const MAX_STEP = 0.01; // 10ms per step
        let remainingDt = dt;
        
        while(remainingDt > 0) {
            const step = Math.min(remainingDt, MAX_STEP);
            const effectiveDash = input.dash || (p.dashBuffer > 0 && p.canDash);
            
            this.updatePhysicsSubStep(step, { ...input, dash: effectiveDash });
            remainingDt -= step;
        }

        if (!wasGrounded && p.grounded) {
            p.sx = 1.4; p.sy = 0.6;
            if (!p.canDash) p.flashTimer = 0.1; 
        }
        
        this.checkEntityCollisions();
        
        p.followingBerries.forEach((b, i) => {
            const delay = (i + 1) * 8;
            if (delay < p.history.length) {
                const target = p.history[delay];
                const dx = target.x - b.x;
                const dy = target.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 1) {
                    const speed = DASH_SPEED * dt;
                    if (dist < speed) {
                        b.x = target.x;
                        b.y = target.y;
                    } else {
                        b.x += (dx / dist) * speed;
                        b.y += (dy / dist) * speed;
                    }
                }
            }
        });

        if (p.grounded && p.followingBerries.length > 0) {
            p.settleTimer += dt;
            if (p.settleTimer > 0.15) { 
                const b = p.followingBerries.shift();
                if (b) {
                    b.state = 2;
                    p.score++;
                    this.onScoreUpdate(Math.floor(Math.abs(p.y)/10), p.score, isRecord);
                    p.settleStreak++;
                    sfx.play('berry', p.settleStreak); 
                    this.spawnEffect(p.x + 12, p.y + 12, COLORS.berry, 8);
                    this.spawnRipple(p.x + 12, p.y + 12);
                    p.settleTimer = 0; 
                }
            }
        } else {
            if (!p.grounded && p.followingBerries.length === 0) {
                 p.settleStreak = 0;
                 p.settleTimer = 0;
            }
        }

        p.sx += (1 - p.sx) * 15 * dt;
        p.sy += (1 - p.sy) * 15 * dt;
        
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > 300) p.history.length = 300;
        
        while (this.spawnY > this.cameraY - 200) this.generateMap();
        
        const dl = this.cameraY + this.viewHeight + 100;
        this.platforms = this.platforms.filter(o => o.y < dl);
        this.solids = this.solids.filter(o => o.y < dl);
        this.springs = this.springs.filter(o => o.y < dl);
        this.berries = this.berries.filter(o => o.state !== 2 && (o.y < dl || o.state === 1));
        this.crystals = this.crystals.filter(o => o.y < dl);
        this.crystals.forEach(c => {
             const o = c.respawnTimer;
             if (c.respawnTimer > 0) {
                 c.respawnTimer -= dt;
                 if (c.respawnTimer < 0.5 && Math.random() < 0.3) {
                     const angle = Math.random() * Math.PI * 2;
                     const dist = 25;
                     const px = (c.x + 15) + Math.cos(angle) * dist;
                     const py = (c.y + 15) + Math.sin(angle) * dist;
                     this.particles.push({
                         x: px, y: py,
                         vx: -Math.cos(angle) * 100, 
                         vy: -Math.sin(angle) * 100,
                         life: c.respawnTimer + 0.1, 
                         color: COLORS.crystal,
                         size: 2
                     });
                 }
             }
             if (o > 0 && c.respawnTimer <= 0) {
                 sfx.play('respawn');
                 this.spawnRipple(c.x + 15, c.y + 15);
                 this.spawnEffect(c.x + 15, c.y + 15, COLORS.crystal, 12);
             }
        });
        
        this.particles.forEach(pt => {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt * 2;
        });
        this.particles = this.particles.filter(pt => pt.life > 0);
        
        this.ripples.forEach(r => {
            r.r += dt * 150;
            r.alpha -= dt * 2.5;
        });
        this.ripples = this.ripples.filter(r => r.alpha > 0);
    }

    // --- CORE PHYSICS SUB-STEP ---
    updatePhysicsSubStep(dt: number, input: { dir: number, jump: boolean, dash: boolean }) {
        const p = this.player;

        if (p.jumpBuffer > 0 && p.wallBounceTimer > 0) {
            let wbDir = 0;
            const checkRect = { x: p.x - 12, y: p.y, w: p.w + 24, h: p.h };
            for (const s of this.solids) {
                if (this.AABB(checkRect, s)) {
                    wbDir = (s.x > p.x) ? 1 : -1;
                    break;
                }
            }
            if (wbDir !== 0) {
                p.jumpBuffer = 0; p.wallBounceTimer = 0; p.isDashing = false; p.dashTimer = 0;
                p.vy = -950; p.vx = -wbDir * WALL_JUMP_X; 
                p.wallJumpTimer = 0.2; p.sx = 0.5; p.sy = 1.5;
                p.flashTimer = 0.1; 
                sfx.play('bounce'); this.spawnRipple(p.x + p.w / 2, p.y + p.h / 2);
                return; 
            }
        }

        if (input.dash && p.canDash && !p.isDashing) {
            let dx = 0; let dy = -1;
            if (input.dir !== 0) { dx = input.dir * 0.707; dy = -0.707; }
            p.isDashing = true; p.canDash = false; p.dashTimer = DASH_TIME;
            p.jumpBuffer = 0; p.coyoteTimer = 0; p.grounded = false;
            p.vx = dx * DASH_SPEED; p.vy = dy * DASH_SPEED;
            this.hitStop = 0.05; p.dashDx = dx; p.dashDy = dy;
            p.sx = 0.6; p.sy = 1.4; sfx.play('dash'); this.shake = 6;
            this.vibrate(15); // Haptic
            p.dashBuffer = 0; 
        }

        if (p.isDashing) {
            p.dashTimer -= dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false; p.vx *= 0.5; p.vy *= 0.5;
            }
        } else {
            let inputX = input.dir;
            if (p.wallJumpTimer > 0) inputX = 0;
            if (inputX !== 0) p.faceDir = inputX;

            let accel = p.grounded ? 30 : 18;
            if (Math.abs(p.vx) > DASH_SPEED) accel = 2; 
            if (p.wallJumpTimer <= 0) p.vx += (inputX * 320 - p.vx) * accel * dt;
            p.vy += GRAVITY * dt;
        }

        if (!p.isDashing) {
            p.onWall = 0;
            if (this.checkWallOverlap(-2)) p.onWall = -1;
            else if (this.checkWallOverlap(2)) p.onWall = 1;

            const pushingWall = (p.onWall === 1 && input.dir === 1) || (p.onWall === -1 && input.dir === -1);
            if (p.vy > 0 && pushingWall) {
                if (p.vy > WALL_SLIDE_SPEED) p.vy = WALL_SLIDE_SPEED;
                if (Math.random() > 0.8) this.spawnEffect(p.onWall === 1 ? p.x + p.w : p.x, p.y + Math.random() * p.h, '#fff', 1);
            }

            if (p.jumpBuffer > 0) {
                if (p.grounded || p.coyoteTimer > 0) {
                    p.vy = JUMP_FORCE; p.grounded = false; p.coyoteTimer = 0; p.jumpBuffer = 0;
                    p.sx = 0.6; p.sy = 1.4; sfx.play('jump');
                } else if (p.onWall !== 0) {
                    p.vy = WALL_JUMP_Y; p.vx = -p.onWall * WALL_JUMP_X;
                    if (input.dir === p.onWall || input.dir === 0) p.wallJumpTimer = 0.15; else p.wallJumpTimer = 0;
                    p.jumpBuffer = 0; p.onWall = 0; sfx.play('jump');
                    p.sx = 0.6; p.sy = 1.4;
                }
            }
        }

        p.x += p.vx * dt;
        this.resolveSolidsX();
        this.checkBounds(); 

        p.y += p.vy * dt;
        p.grounded = false; 
        
        if (!p.isDashing && p.vy > 0) {
            this.checkPlatformCollisions();
        }

        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        for (const s of this.solids) {
            if (this.AABB(rect, s)) {
                const overlapLeft = (p.x + p.w) - s.x;
                const overlapRight = (s.x + s.w) - p.x;
                
                if (overlapLeft < 10) {
                    p.x = s.x - p.w - 0.1; 
                } else if (overlapRight < 10) {
                    p.x = s.x + s.w + 0.1; 
                } else {
                    if (p.vy > 0) {
                        p.y = s.y - p.h;
                        p.vy = 0;
                        p.grounded = true;
                    } else if (p.vy < 0) {
                        p.y = s.y + s.h;
                        p.vy = 0;
                    }
                }
            }
        }

        if (p.grounded) {
            p.canDash = true; 
        }
    }

    checkWallOverlap(offset: number): boolean {
        const p = this.player;
        const rect = { x: p.x + offset, y: p.y, w: p.w, h: p.h };
        for (const s of this.solids) {
            if (this.AABB(rect, s)) return true;
        }
        return false;
    }

    die() {
        if (this.state === GameState.DYING) return;
        this.state = GameState.DYING;
        sfx.play('death');
        this.vibrate(200);
        
        this.deathRipple.active = true;
        this.deathRipple.x = this.player.x + this.player.w / 2;
        this.deathRipple.y = this.player.y + this.player.h / 2;
        this.deathRipple.r = 0;
        this.deathRipple.maxR = Math.max(VIEW_WIDTH, this.viewHeight) * 1.5;
        this.deathRipple.color = '#fff';
    }

    draw() {
        const ctx = this.ctx;
        const width = VIEW_WIDTH;
        const height = this.viewHeight;

        // Clear and Draw Background
        const r = Math.round(this.currentBg[0]);
        const g = Math.round(this.currentBg[1]);
        const b = Math.round(this.currentBg[2]);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, width, height);

        if (this.bgImg) {
            const bgY = (this.cameraY * 0.3) % 960;
            ctx.drawImage(this.bgImg, 0, -bgY, width, 960);
            if (-bgY + 960 < height) {
                ctx.drawImage(this.bgImg, 0, -bgY + 960, width, 960);
            }
        }

        ctx.save();
        
        // Camera & Shake
        let shakeX = 0, shakeY = 0;
        if (this.shake > 0) {
            shakeX = (Math.random() - 0.5) * this.shake;
            shakeY = (Math.random() - 0.5) * this.shake;
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }
        ctx.translate(0, -this.cameraY);
        ctx.translate(shakeX, shakeY);

        // Solids
        for (const s of this.solids) {
             if (this.tilesetImg) {
                 this.drawTiledRect(s.x, s.y, s.w, s.h);
             } else {
                 ctx.fillStyle = COLORS.rock;
                 ctx.fillRect(s.x, s.y, s.w, s.h);
             }
        }

        // Platforms
        for (const p of this.platforms) {
            if (this.platformImg) {
                const parts = Math.ceil(p.w / TILE_SIZE);
                for(let i=0; i<parts; i++) {
                     // Clip the last tile if needed
                     const drawW = Math.min(TILE_SIZE, p.w - i*TILE_SIZE);
                     ctx.drawImage(this.platformImg, 0, 0, drawW, 14, p.x + i*TILE_SIZE, p.y, drawW, 14);
                }
            } else {
                ctx.fillStyle = '#5c4436';
                ctx.fillRect(p.x, p.y, p.w, p.h);
            }
        }

        // Springs
        for (const s of this.springs) {
            if (this.springImg) {
                ctx.save();
                ctx.translate(s.x + s.w/2, s.y + s.h/2);
                if (s.dir === 'left') ctx.rotate(Math.PI/2);
                if (s.dir === 'right') ctx.rotate(-Math.PI/2);
                
                let scaleY = 1;
                if (s.animTimer > 0) {
                    scaleY = 1 + Math.sin(s.animTimer * 20) * 0.5;
                }
                ctx.scale(1, scaleY);
                ctx.drawImage(this.springImg, -12, -12);
                ctx.restore();
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(s.x, s.y, s.w, s.h);
            }
        }

        // Crystals
        for (const c of this.crystals) {
            if (c.respawnTimer <= 0) {
                ctx.fillStyle = COLORS.crystal;
                ctx.beginPath();
                ctx.arc(c.x + 15, c.y + 15, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Glow
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.arc(c.x + 15, c.y + 15, 12 + Math.sin(Date.now()/200)*3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                 ctx.fillStyle = '#444';
                 ctx.beginPath();
                 ctx.arc(c.x + 15, c.y + 15, 4, 0, Math.PI*2);
                 ctx.fill();
            }
        }

        // Berries
        for (const b of this.berries) {
            if (b.state === 2) continue;
            let bx = b.x;
            let by = b.y;
            if (b.state === 0) by = b.baseY + Math.sin(Date.now() / 300) * 5;

            // Wings if following
            if (b.state === 1) {
                ctx.fillStyle = '#fff';
                const flap = Math.sin(Date.now() / 50) * 5;
                // Left Wing
                ctx.beginPath(); ctx.moveTo(bx + 10, by + 10); ctx.lineTo(bx - 5, by - 5 + flap); ctx.lineTo(bx + 5, by + 15); ctx.fill();
                // Right Wing
                ctx.beginPath(); ctx.moveTo(bx + 20, by + 10); ctx.lineTo(bx + 35, by - 5 + flap); ctx.lineTo(bx + 25, by + 15); ctx.fill();
            }
            
            ctx.fillStyle = COLORS.berry;
            ctx.beginPath(); ctx.arc(bx + 15, by + 15, 10, 0, Math.PI * 2); ctx.fill();
        }

        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1;
        }

        // Ripples
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (const r of this.ripples) {
            ctx.globalAlpha = r.alpha;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Player
        if (this.state !== GameState.DYING) {
            this.drawPlayer(ctx);
        } else if (this.deathRipple.active) {
            ctx.fillStyle = this.deathRipple.color;
            ctx.beginPath(); ctx.arc(this.deathRipple.x, this.deathRipple.y, this.deathRipple.r, 0, Math.PI*2); ctx.fill();
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath(); ctx.arc(this.deathRipple.x, this.deathRipple.y, Math.max(0, this.deathRipple.r - 40), 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        // Snow
        ctx.fillStyle = '#fff';
        for (const s of this.snow) {
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }

        ctx.restore();
    }

    drawTiledRect(x: number, y: number, w: number, h: number) {
        if (!this.tilesetImg) return;
        const ctx = this.ctx;
        
        const cols = Math.ceil(w / TILE_SIZE);
        const rows = Math.ceil(h / TILE_SIZE);
        
        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                const dw = Math.min(TILE_SIZE, w - c*TILE_SIZE);
                const dh = Math.min(TILE_SIZE, h - r*TILE_SIZE);
                // Use the top-left 24x24 as the texture
                ctx.drawImage(this.tilesetImg, 0, 0, dw, dh, x + c*TILE_SIZE, y + r*TILE_SIZE, dw, dh);
            }
        }
        
        // Draw snow cap
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, w, 4);
    }

    drawPlayer(ctx: CanvasRenderingContext2D) {
        const p = this.player;
        ctx.save();
        ctx.translate(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h / 2));
        ctx.scale(p.sx * p.faceDir, p.sy);

        const color = p.isDashing ? COLORS.hairDash : (p.canDash ? COLORS.hairIdle : COLORS.hairNoDash);
        if (p.flashTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) ctx.fillStyle = '#fff';
        else ctx.fillStyle = color;

        // Hair
        ctx.fillRect(-10, -10, 20, 20); // Placeholder hair block

        // Body
        ctx.fillStyle = p.flashTimer > 0 ? '#fff' : color;
        ctx.fillRect(-6, -6, 12, 12);
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(2, -4, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(4, -2, 2, 2);

        ctx.restore();
    }
}
