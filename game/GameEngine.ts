
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
        dashBuffer: 0, // New: Input buffering
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
        
        // Ground: Optimized size to prevent lag (reduced height to 48px from 400px)
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
                const springX = side === 'right' ? x + w : x - TILE_SIZE;
                const springY = (currentY - hS) + Math.floor(Math.random() * hTiles) * TILE_SIZE;
                
                if (springX >= 0 && springX < VIEW_WIDTH) {
                    // Safety check neighbors
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
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
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
            // Use slightly smaller hitbox for interaction trigger to prevent corner bugs
            if (this.AABB(rect, { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 12 })) {
                sfx.play('spring');
                s.animTimer = 0.2;
                
                // Restore State
                p.canDash = true; 
                p.isDashing = false;
                p.dashTimer = 0;
                p.flashTimer = 0.1; // Flash
                
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
                // Buffering check: If dash pressed recently, trigger it now
                const dashQueued = p.dashBuffer > 0;
                if (!p.canDash || dashQueued) {
                    p.canDash = true;
                    c.respawnTimer = 2.5;
                    sfx.play('crystal');
                    this.hitStop = 0.05;
                    this.shake = 4;
                    p.flashTimer = 0.1;
                    this.spawnEffect(c.x + 15, c.y + 15, COLORS.crystal, 5);
                    
                    // Auto Dash from buffer is handled in updatePhysicsSubStep
                }
            }
        }

        // Berries
        for (const b of this.berries) {
            if (b.state === 0 && this.AABB(rect, b)) {
                b.state = 1;
                p.followingBerries.push(b);
                // Settle streak is reset when grounded logic runs, but pickup sound uses current length
                // We'll play a simple pickup sound here, combo sound happens on collect (landing)
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

        // Buffer Input
        if (input.dash && !p.canDash) {
            p.dashBuffer = 0.08; // 80ms buffer
        }

        // Camera
        const targetY = p.y - this.viewHeight * 0.45;
        if (targetY < this.cameraY) {
            this.cameraY += (targetY - this.cameraY) * 0.15;
        }

        // Score
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

        // Death Check
        if (p.y > this.cameraY + this.viewHeight + 100) {
            this.die();
            return;
        }

        // Timers
        if (p.grounded) p.coyoteTimer = 0.1; else p.coyoteTimer -= dt;
        if (input.jump) p.jumpBuffer = 0.15;
        if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
        if (p.wallJumpTimer > 0) p.wallJumpTimer -= dt;

        // Spring Animations
        this.springs.forEach(s => {
            if (s.animTimer > 0) s.animTimer -= dt;
        });

        // Wall Bounce Grace Period
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
            // Check Buffer Dash execution inside physics step for frame-perfect feel?
            // Actually, we need to inject the dash input if buffer is valid and canDash is true
            const effectiveDash = input.dash || (p.dashBuffer > 0 && p.canDash);
            
            this.updatePhysicsSubStep(step, { ...input, dash: effectiveDash });
            remainingDt -= step;
        }

        // Visual Effects after physics
        if (!wasGrounded && p.grounded) {
            p.sx = 1.4; p.sy = 0.6;
            if (!p.canDash) p.flashTimer = 0.1; 
        }
        
        this.checkEntityCollisions();
        
        // Berry Following Smoothing
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

        // Berry Collection (Combo Logic)
        if (p.grounded && p.followingBerries.length > 0) {
            p.settleTimer += dt;
            if (p.settleTimer > 0.15) { // Fast interval
                const b = p.followingBerries.shift();
                if (b) {
                    b.state = 2;
                    p.score++;
                    this.onScoreUpdate(Math.floor(Math.abs(p.y)/10), p.score, isRecord);
                    p.settleStreak++;
                    sfx.play('berry', p.settleStreak); // Play ascending tone
                    this.spawnEffect(p.x + 12, p.y + 12, COLORS.berry, 8);
                    this.spawnRipple(p.x + 12, p.y + 12);
                    p.settleTimer = 0; // Reset for next berry in chain
                }
            }
        } else {
            // Reset combo if in air or no berries
            if (!p.grounded && p.followingBerries.length === 0) {
                 p.settleStreak = 0;
                 p.settleTimer = 0;
            }
        }

        // Squash/Stretch Recovery
        p.sx += (1 - p.sx) * 15 * dt;
        p.sy += (1 - p.sy) * 15 * dt;
        
        // History for Berry Follow
        p.history.unshift({ x: p.x, y: p.y });
        if (p.history.length > 300) p.history.length = 300;
        
        // Procedural Generation
        while (this.spawnY > this.cameraY - 200) this.generateMap();
        
        // Cleanup
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

        // 1. Wall Bounce / Dash Start Logic (Priority)
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
                p.flashTimer = 0.1; // Flash
                sfx.play('bounce'); this.spawnRipple(p.x + p.w / 2, p.y + p.h / 2);
                return; // Skip rest of physics this step
            }
        }

        // Dash Trigger: Either direct input OR buffered input
        if (input.dash && p.canDash && !p.isDashing) {
            let dx = 0; let dy = -1;
            if (input.dir !== 0) { dx = input.dir * 0.707; dy = -0.707; }
            p.isDashing = true; p.canDash = false; p.dashTimer = DASH_TIME;
            p.jumpBuffer = 0; p.coyoteTimer = 0; p.grounded = false;
            p.vx = dx * DASH_SPEED; p.vy = dy * DASH_SPEED;
            this.hitStop = 0.05; p.dashDx = dx; p.dashDy = dy;
            p.sx = 0.6; p.sy = 1.4; sfx.play('dash'); this.shake = 6;
            p.dashBuffer = 0; // Consume buffer
        }

        // 2. Velocity Calculation
        if (p.isDashing) {
            p.dashTimer -= dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false; p.vx *= 0.5; p.vy *= 0.5;
            }
        } else {
            // Normal movement
            let inputX = input.dir;
            if (p.wallJumpTimer > 0) inputX = 0;
            if (inputX !== 0) p.faceDir = inputX;

            let accel = p.grounded ? 30 : 18;
            if (Math.abs(p.vx) > DASH_SPEED) accel = 2; 
            if (p.wallJumpTimer <= 0) p.vx += (inputX * 320 - p.vx) * accel * dt;
            p.vy += GRAVITY * dt;
        }

        // 3. Wall Slide & Jump
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
                    // Ground Jump
                    p.vy = JUMP_FORCE; p.grounded = false; p.coyoteTimer = 0; p.jumpBuffer = 0;
                    p.sx = 0.6; p.sy = 1.4; sfx.play('jump');
                } else if (p.onWall !== 0) {
                    // Wall Jump
                    p.vy = WALL_JUMP_Y; p.vx = -p.onWall * WALL_JUMP_X;
                    if (input.dir === p.onWall || input.dir === 0) p.wallJumpTimer = 0.15; else p.wallJumpTimer = 0;
                    p.jumpBuffer = 0; p.onWall = 0; sfx.play('jump');
                    p.sx = 0.6; p.sy = 1.4;
                }
            }
        }

        // 4. X Movement & Collision
        p.x += p.vx * dt;
        this.resolveSolidsX();
        this.checkBounds(); // Ensure inside screen horizontally

        // 5. Y Movement & Collision (With Corner Correction)
        p.y += p.vy * dt;
        p.grounded = false; // Assume air unless we hit something
        
        // Platform (One-way) collision
        if (!p.isDashing && p.vy > 0) {
            this.checkPlatformCollisions();
        }

        // Solid Y Collision + Corner Correction
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        for (const s of this.solids) {
            if (this.AABB(rect, s)) {
                // Corner Correction Check
                const overlapLeft = (p.x + p.w) - s.x;
                const overlapRight = (s.x + s.w) - p.x;
                
                // If barely clipping an edge, push OUT instead of stopping Y
                if (overlapLeft < 10) {
                    p.x = s.x - p.w - 0.1; // Push Left
                    // Don't stop Y, just correct X and continue
                } else if (overlapRight < 10) {
                    p.x = s.x + s.w + 0.1; // Push Right
                } else {
                    // Full Y Collision
                    if (p.vy > 0) {
                        // Landed
                        p.y = s.y - p.h;
                        p.vy = 0;
                        p.grounded = true;
                    } else if (p.vy < 0) {
                        // Bonked Head
                        p.y = s.y + s.h;
                        p.vy = 0;
                    }
                }
            }
        }

        // 6. State Updates
        if (p.grounded) {
            p.canDash = true; 
            // Note: Settle Timer for berries is handled in main loop to allow consistent timing
        }
    }

    checkWallOverlap(ox: number) {
        const p = this.player;
        const check = { x: p.x + ox, y: p.y + 4, w: p.w, h: p.h - 8 };
        for(const s of this.solids) if(this.AABB(check, s)) return true;
        return false;
    }

    die() {
        this.state = GameState.DYING;
        sfx.play('death');
        const p = this.player;
        
        // Init Ripple
        this.deathRipple.active = true;
        this.deathRipple.x = p.x + p.w / 2;
        this.deathRipple.y = p.y + p.h / 2;
        if (this.deathRipple.y > this.cameraY + this.viewHeight) {
            this.deathRipple.y = this.cameraY + this.viewHeight;
        }
        this.deathRipple.r = 0;
        this.deathRipple.maxR = Math.max(VIEW_WIDTH, this.viewHeight) * 1.5;
        this.deathRipple.color = p.canDash ? COLORS.hairIdle : COLORS.hairNoDash;

        if (p.highestY > this.highScore) {
            this.highScore = p.highestY;
            localStorage.setItem('dc_highscore', this.highScore.toString());
        }
    }

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const p = this.player;
        const camY = Math.floor(this.cameraY); // integer camera

        // --- DRAW BACKGROUND ---
        ctx.save();
        if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
            // Parallax factor (e.g. 0.5 speed)
            const py = -camY * 0.1; 
            // Tile vertical if needed
            const bgH = 960;
            const y1 = (py % bgH) - bgH;
            const y2 = (py % bgH);
            const y3 = (py % bgH) + bgH;
            
            // Draw 3 copies to cover viewport loop
            ctx.drawImage(this.bgImg, 0, Math.floor(y1));
            ctx.drawImage(this.bgImg, 0, Math.floor(y2));
            ctx.drawImage(this.bgImg, 0, Math.floor(y3));
        } else {
            ctx.fillStyle = '#1d1d2b';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.restore();

        // Snow (Background layer) - clean pixel squares
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.snow.forEach(s => {
            ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.floor(s.size), Math.floor(s.size));
        });

        // Special Rendering for Death
        if (this.state === GameState.DYING) {
            ctx.save();
            ctx.translate(0, -camY);
            // Draw world elements behind ripple
            this.platforms.forEach(pl => {
                if (this.platformImg && this.platformImg.complete && this.platformImg.naturalWidth > 0) {
                    for(let x = pl.x; x < pl.x + pl.w; x += TILE_SIZE) {
                        ctx.drawImage(this.platformImg, Math.floor(x), Math.floor(pl.y));
                    }
                } else {
                    ctx.fillStyle = COLORS.rock;
                    ctx.fillRect(Math.floor(pl.x), Math.floor(pl.y), pl.w, pl.h);
                }
            });
            this.solids.forEach(s => {
               // Fallback if textures missing during death to maintain consistent look
               ctx.fillStyle = '#201c3b';
               ctx.fillRect(s.x, s.y, s.w, s.h);
            });
            ctx.restore();

            // Ripple
            if (this.deathRipple.active) {
                ctx.save();
                ctx.fillStyle = this.deathRipple.color;
                ctx.beginPath();
                ctx.arc(Math.floor(this.deathRipple.x), Math.floor(this.deathRipple.y - camY), Math.floor(this.deathRipple.r), 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            return;
        }

        ctx.save();
        
        // Screen Shake
        let sx = 0, sy = 0;
        if (this.shake > 0) {
            sx = Math.floor((Math.random() - 0.5) * this.shake);
            sy = Math.floor((Math.random() - 0.5) * this.shake);
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }
        ctx.translate(sx, -camY + sy);

        // Best Score Line
        if (this.highScore > 0) {
            const hy = -this.highScore * 10;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(0, Math.floor(hy));
            ctx.lineTo(VIEW_WIDTH, Math.floor(hy));
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`BEST: ${this.highScore}m`, 10, Math.floor(hy - 10));
        }

        // Draw Platforms (Bridge)
        this.platforms.forEach(pl => {
            if (this.platformImg && this.platformImg.complete && this.platformImg.naturalWidth > 0) {
                for(let x = pl.x; x < pl.x + pl.w; x += TILE_SIZE) {
                    // Draw Bridge Segment
                    ctx.drawImage(this.platformImg, Math.floor(x), Math.floor(pl.y));
                }
            } else {
                ctx.fillStyle = COLORS.rock;
                ctx.fillRect(Math.floor(pl.x), Math.floor(pl.y), pl.w, pl.h);
            }
        });

        // --- DRAW SOLIDS WITH AUTO-TILING ---
        if (this.tilesetImg && this.tilesetImg.complete && this.tilesetImg.naturalWidth > 0) {
            const TS = TILE_SIZE; // 24
            
            for(const s of this.solids) {
                // Iterate over every 24x24 chunk in this solid
                for(let x = s.x; x < s.x + s.w; x += TS) {
                    for(let y = s.y; y < s.y + s.h; y += TS) {
                        
                        // Neighbor Checks (Is there a solid adjancent?)
                        const u = this.isSolidAt(x, y - TS);
                        const d = this.isSolidAt(x, y + TS);
                        const l = this.isSolidAt(x - TS, y);
                        const r = this.isSolidAt(x + TS, y);
                        
                        // Determine Source X (Horizontal State)
                        let srcX = 24; // Center by default
                        if (!l && r) srcX = 0;       // Left Edge
                        else if (l && !r) srcX = 48; // Right Edge
                        else if (!l && !r) srcX = 72; // Single Column
                        
                        // Determine Source Y (Vertical State)
                        let srcY = 24; // Middle by default
                        if (!u) srcY = 0;       // Top (Snow)
                        else if (!d) srcY = 48; // Bottom
                        
                        ctx.drawImage(
                            this.tilesetImg, 
                            srcX, srcY, TS, TS, 
                            Math.floor(x), Math.floor(y), TS, TS
                        );
                    }
                }
            }
        } else {
             // Fallback (Improved Color)
             this.solids.forEach(s => {
                ctx.fillStyle = '#201c3b'; // Deep Purple base color
                ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.w, s.h);
                // Simple border fallback
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#68c2d3';
                ctx.strokeRect(Math.floor(s.x), Math.floor(s.y), s.w, s.h);
             });
        }

        // Draw Springs
        if (this.springImg && this.springImg.complete && this.springImg.naturalWidth > 0) {
            this.springs.forEach(s => {
                ctx.save();
                ctx.translate(s.x + s.w/2, s.y + s.h/2);
                
                // Rotation based on direction
                if (s.dir === 'left') ctx.rotate(Math.PI / 2);
                else if (s.dir === 'right') ctx.rotate(-Math.PI / 2);
                
                // Animation Scale ("Boing" effect)
                let scaleY = 1;
                if (s.animTimer > 0) {
                    // Simple bounce curve: Expand -> Contract
                    const t = 1 - (s.animTimer / 0.2); // 0 to 1
                    scaleY = 1 + Math.sin(t * Math.PI) * 0.5;
                }
                ctx.scale(1, scaleY);
                
                ctx.drawImage(this.springImg!, -12, -12); // Centered
                ctx.restore();
            });
        } else {
            // Fallback spring
            this.springs.forEach(s => {
                ctx.fillStyle = '#e04040';
                ctx.fillRect(s.x, s.y, s.w, s.h);
            });
        }

        // Crystals
        this.crystals.forEach(c => {
            const cx = Math.floor(c.x + 15);
            const cy = Math.floor(c.y);
            if (c.respawnTimer <= 0) {
                const h = Math.sin(Date.now() / 200) * 4;
                ctx.fillStyle = COLORS.crystal;
                ctx.beginPath();
                ctx.moveTo(cx, cy + h);
                ctx.lineTo(cx + 12, cy + 16 + h);
                ctx.lineTo(cx, cy + 32 + h);
                ctx.lineTo(cx - 12, cy + 16 + h);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,255,100,0.4)';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                ctx.strokeStyle = '#555';
                ctx.setLineDash([2, 2]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + 12, cy + 16);
                ctx.lineTo(cx, cy + 32);
                ctx.lineTo(cx - 12, cy + 16);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Berries
        this.berries.forEach(b => {
            if (b.state !== 2) {
                const by = b.state === 0 ? b.baseY + Math.sin(Date.now() / 200) * 5 : b.y;
                ctx.globalAlpha = b.state === 1 ? 0.8 : 1;
                ctx.fillStyle = COLORS.berry;
                ctx.beginPath();
                ctx.arc(Math.floor(b.x + 15), Math.floor(by + 15), 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#00e436';
                ctx.beginPath();
                ctx.moveTo(Math.floor(b.x + 9), Math.floor(by + 11));
                ctx.lineTo(Math.floor(b.x + 15), Math.floor(by + 6));
                ctx.lineTo(Math.floor(b.x + 21), Math.floor(by + 11));
                ctx.lineTo(Math.floor(b.x + 15), Math.floor(by + 15));
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        });

        // Particles
        this.particles.forEach(pt => {
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life;
            ctx.fillRect(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.size), Math.floor(pt.size));
        });
        ctx.globalAlpha = 1;

        // Ripples
        this.ripples.forEach(r => {
            ctx.beginPath();
            ctx.arc(Math.floor(r.x), Math.floor(r.y), Math.floor(r.r), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,200,200,${r.alpha})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        });

        // --- PLAYER DRAWING ---
        p.trail.forEach(t => {
            ctx.save();
            ctx.translate(Math.floor(t.x + 12), Math.floor(t.y + 12));
            if (t.dash) {
                ctx.rotate(Math.atan2(t.dy, t.dx) + Math.PI / 2);
                ctx.scale(0.6, 1.6);
            }
            ctx.fillStyle = `rgba(255,255,255,${t.alpha})`;
            ctx.fillRect(-12, -12, 24, 24);
            ctx.restore();
            t.alpha -= 0.15;
        });
        p.trail = p.trail.filter(t => t.alpha > 0);

        ctx.save();
        ctx.translate(Math.floor(p.x + 12), Math.floor(p.y + 12));
        if (p.isDashing) {
            ctx.rotate(Math.atan2(p.dashDy, p.dashDx) + Math.PI / 2);
            ctx.scale(0.6, 1.6);
            if (Math.random() > 0.5) {
                p.trail.push({ x: p.x, y: p.y, alpha: 0.8, dash: true, dx: p.dashDx, dy: p.dashDy });
            }
        } else {
            ctx.scale(p.sx, p.sy);
        }
        
        // Flash white if dash restored or state refreshed
        if (p.flashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = p.isDashing ? '#fff' : (p.canDash ? COLORS.hairIdle : COLORS.hairNoDash);
        }
        ctx.fillRect(-12, -12, 24, 24);
        
        // Eyes
        if (!p.isDashing) {
            ctx.fillStyle = '#000';
            const lx = p.faceDir * 2;
            ctx.fillRect(-6 + lx, -6, 4, 4);
            ctx.fillRect(2 + lx, -6, 4, 4);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-6 + lx, -6, 1, 1);
            ctx.fillRect(2 + lx, -6, 1, 1);
        }
        ctx.restore();

        // Direction Indicator (Restored & Integer aligned)
        if (!p.isDashing) {
            let ang = -Math.PI / 2;
            if (this.lastInputDir === -1) ang = -Math.PI * 0.75;
            else if (this.lastInputDir === 1) ang = -Math.PI * 0.25;
            
            ctx.save();
            ctx.translate(Math.floor(p.x + 12), Math.floor(p.y + 12));
            ctx.translate(Math.floor(Math.cos(ang) * 35), Math.floor(Math.sin(ang) * 35));
            ctx.rotate(ang + Math.PI / 2);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▲', 0, 0);
            ctx.restore();
        }

        const screenY = p.y - this.cameraY;
        if (screenY > this.viewHeight && screenY < this.viewHeight + 150) {
             ctx.save();
             ctx.translate(0, camY); // Use camY (integer)
             const iy = camY + this.viewHeight - 30;
             const ix = Math.max(20, Math.min(VIEW_WIDTH - 20, p.x + p.w/2));
             ctx.fillStyle = p.canDash ? COLORS.hairIdle : COLORS.hairNoDash;
             ctx.beginPath();
             ctx.moveTo(ix, iy);
             ctx.lineTo(ix - 10, iy - 15);
             ctx.lineTo(ix + 10, iy - 15);
             ctx.fill();
             ctx.restore();
        }

        ctx.restore();
    }
}
