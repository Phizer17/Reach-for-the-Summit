
import { GameState, Rect, Platform, Berry, Crystal, Solid, Particle, Spring, TrailPoint } from '../types';
import { COLORS, CHAPTERS, VIEW_WIDTH, TILE_SIZE, GRAVITY, DASH_SPEED, WALL_SLIDE_SPEED, WALL_JUMP_X, WALL_JUMP_Y, JUMP_FORCE, DASH_TIME, SPRING_SPEED_Y, SPRING_SPEED_X, SPRING_SIDE_LIFT, MAX_SPEED, ACCEL_TIME, DECEL_TIME } from '../constants';
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
    berryImg: HTMLImageElement | null = null; 
    
    // Generation State
    lastWasCrystal: boolean = false;
    lastWasSpringUp: boolean = false;
    lastSolidY: number = 0; 
    
    // Entities
    player = {
        x: 0, y: 0, w: 24, h: 24, vx: 0, vy: 0,
        faceDir: 1, grounded: false, canDash: true, isDashing: false,
        dashTimer: 0, dashDx: 0, dashDy: 0,
        highestY: 0, score: 0,
        trail: [] as TrailPoint[], 
        history: [] as any[], followingBerries: [] as Berry[],
        sx: 1, sy: 1, jumpBuffer: 0, coyoteTimer: 0, wallJumpTimer: 0, onWall: 0,
        settleTimer: 0, settleStreak: 0,
        lastMilestone: 0,
        wallBounceTimer: 0,
        flashTimer: 0,
        dashBuffer: 0, 
        blinkTimer: 0, 
        moveTimer: 0,
        hasTriggeredRecord: false,
        startTime: 0,
        endTime: 0
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
    
    // Callbacks
    onScoreUpdate: (height: number, berries: number, isRecord: boolean, time: number, pendingBerries: number) => void;
    onGameOver: (height: number, berries: number, newRecord: boolean, time: number) => void;
    onMilestone: (text: string, isRecord: boolean) => void;
    
    constructor(
        canvas: HTMLCanvasElement, 
        onScore: (h: number, b: number, rec: boolean, t: number, pb: number) => void,
        onOver: (h: number, b: number, rec: boolean, t: number) => void,
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
        // Calculate max radius for death ripple
        this.deathRipple.maxR = Math.sqrt(Math.pow(this.canvas.width, 2) + Math.pow(this.canvas.height, 2));
    }

    vibrate(ms: number) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    loadTextures() {
        const c = { base: '#201c3b', mid: '#332c50', light: '#68c2d3', shadow: '#110d21', snow: '#ffffff', snowShade: '#8daac9' };
        const tilesetSvg = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="rockPat" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${c.base}"/><path d="M0 24 L24 0" stroke="${c.mid}" stroke-width="6"/><path d="M-12 24 L12 0" stroke="${c.mid}" stroke-width="6"/><path d="M12 24 L36 0" stroke="${c.mid}" stroke-width="6"/><rect x="6" y="14" width="2" height="2" fill="${c.light}" opacity="0.3"/><rect x="16" y="4" width="2" height="2" fill="${c.light}" opacity="0.3"/></pattern></defs><rect width="96" height="96" fill="url(#rockPat)"/><g><rect x="0" y="0" width="2" height="96" fill="${c.light}"/><rect x="2" y="0" width="2" height="96" fill="${c.mid}" opacity="0.5"/></g><g transform="translate(48, 0)"><rect x="22" y="0" width="2" height="96" fill="${c.shadow}"/><rect x="20" y="0" width="2" height="96" fill="${c.shadow}" opacity="0.5"/></g><g transform="translate(72, 0)"><rect x="0" y="0" width="2" height="96" fill="${c.light}"/><rect x="22" y="0" width="2" height="96" fill="${c.shadow}"/></g><g><rect x="0" y="0" width="96" height="6" fill="${c.snow}"/><rect x="0" y="6" width="96" height="2" fill="${c.snowShade}"/><path d="M4 8 H8 V10 H4 Z" fill="${c.snow}"/><path d="M20 8 H26 V11 H20 Z" fill="${c.snow}"/><path d="M44 8 H48 V9 H44 Z" fill="${c.snow}"/><path d="M60 8 H66 V12 H60 Z" fill="${c.snow}"/><path d="M85 8 H88 V10 H85 Z" fill="${c.snow}"/><rect x="0" y="0" width="2" height="6" fill="${c.snow}"/><rect x="94" y="0" width="2" height="6" fill="${c.snow}"/></g><g transform="translate(0, 48)"><rect x="0" y="22" width="96" height="2" fill="${c.shadow}"/><rect x="0" y="20" width="96" height="2" fill="${c.shadow}" opacity="0.5"/></g><g transform="translate(0, 72)"><rect x="0" y="22" width="96" height="2" fill="${c.shadow}"/><rect x="0" y="20" width="96" height="2" fill="${c.shadow}" opacity="0.5"/><rect x="0" y="0" width="96" height="6" fill="${c.snow}"/><rect x="0" y="6" width="96" height="2" fill="${c.snowShade}"/></g></svg>`.trim();
        this.tilesetImg = new Image(); this.tilesetImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(tilesetSvg);

        const platformSvg = `<svg width="24" height="14" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="2" width="24" height="8" fill="#5c4436"/><rect x="0" y="2" width="24" height="2" fill="#82604d"/> <rect x="0" y="9" width="24" height="1" fill="#33251d"/> <rect x="4" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/><rect x="18" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/><rect x="0" y="0" width="24" height="3" fill="#e8f7ff"/></svg>`.trim();
        this.platformImg = new Image(); this.platformImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(platformSvg);

        const springSvg = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="18" width="20" height="6" rx="2" fill="#555"/><rect x="3" y="19" width="18" height="4" fill="#333"/><path d="M4 18 L20 18 L4 14 L20 14 L4 10" stroke="#ccc" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="2" y="8" width="20" height="4" rx="1" fill="#e04040"/><rect x="4" y="9" width="16" height="2" fill="#ff6666"/></svg>`.trim();
        this.springImg = new Image(); this.springImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(springSvg);

        const bgSvg = `<svg width="552" height="960" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#111221"/><stop offset="100%" stop-color="#282638"/></linearGradient></defs><rect width="552" height="960" fill="url(#sky)"/><path d="M0 960 L0 800 L100 700 L250 850 L400 720 L552 800 L552 960 Z" fill="#1b1b29"/><g fill="#fff" opacity="0.4"><circle cx="50" cy="100" r="1"/><circle cx="200" cy="50" r="1.5"/><circle cx="450" cy="150" r="1"/><circle cx="300" cy="300" r="1"/><circle cx="100" cy="400" r="1"/></g></svg>`.trim();
        this.bgImg = new Image(); this.bgImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(bgSvg);

        const berrySvg = `
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 21 C17 19 20 14 20 10 C20 7 18 5 12 5 C6 5 4 7 4 10 C4 14 7 19 12 21 Z" fill="#ff004d"/>
             <circle cx="8" cy="9" r="1" fill="#fff" opacity="0.6"/>
             <circle cx="16" cy="9" r="1" fill="#fff" opacity="0.6"/>
             <circle cx="12" cy="13" r="1" fill="#fff" opacity="0.6"/>
             <circle cx="8" cy="16" r="1" fill="#fff" opacity="0.6"/>
             <circle cx="16" cy="16" r="1" fill="#fff" opacity="0.6"/>
             <path d="M12 5 L9 3 L8 6 L12 8 L16 6 L15 3 Z" fill="#00e436"/>
        </svg>`.trim();
        this.berryImg = new Image(); this.berryImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(berrySvg);
    }

    initGame() {
        this.platforms = [];
        this.berries = [];
        this.crystals = [];
        this.solids = [];
        this.springs = [];
        this.particles = [];
        this.ripples = [];
        
        this.solids.push({ x: -50, y: 150, w: VIEW_WIDTH + 100, h: 48 });
        this.lastSolidY = 150;
        
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
        this.player.trail = []; 
        this.player.lastMilestone = 0;
        this.player.wallBounceTimer = 0;
        this.player.flashTimer = 0;
        this.player.dashBuffer = 0;
        this.player.blinkTimer = 0;
        this.player.moveTimer = 0;
        this.player.hasTriggeredRecord = false;
        this.player.startTime = Date.now();
        this.player.endTime = 0;
        this.lastMilestone = 0;
        
        this.deathRipple.active = false;
        this.cameraY = -this.viewHeight / 2;
        this.state = GameState.PLAYING;
        this.currentBg = [...this.targetBg];
        this.setChapter(0);
        
        for (let i = 0; i < 10; i++) this.generateMap();
        
        this.onScoreUpdate(0, 0, false, 0, 0);
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
        
        // Safety cap: Player can jump ~120px + Dash ~105px = 225px.
        // 9 tiles = 216px. Limit to 9 to be safe.
        let maxGapTiles = Math.min(9, 7 + Math.floor(heightFactor * 3)); 
        
        let gapTiles = Math.floor(minGapTiles + Math.random() * (maxGapTiles - minGapTiles));
        let baseGap = gapTiles * TILE_SIZE;

        const potentialY = this.spawnY - baseGap;
        // Avoid placing solid immediately above another solid with tiny gap
        if (Math.abs(potentialY - this.lastSolidY) < TILE_SIZE * 3) {
            baseGap += TILE_SIZE * 2; 
        }

        // Special handling for post-spring or post-crystal to prevent unfair gaps
        if (this.lastWasSpringUp) {
            // After spring up, give some air, but ensure next platform is reachable
            // Spring jump is high, but we don't want to overdo it.
            baseGap = 200 + Math.random() * 50;
        } else if (this.lastWasCrystal) {
            // After crystal, user has dash, but gap shouldn't be insane.
            if (baseGap > 180) baseGap = 120 + Math.random() * 40;
        }
        
        this.lastWasCrystal = false;
        this.lastWasSpringUp = false;

        this.spawnY -= baseGap;
        const currentY = this.spawnY;
        
        // --- 1. Crystal Generation ---
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

        // --- 2. Solid Block Generation ---
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
            this.lastSolidY = currentY - hS;
            
            // Berry on Solid
            if (Math.random() > 0.6) {
                const berryX = x + (Math.random() > 0.5 ? -40 : w + 10);
                const berryY = currentY - hS - 20 - Math.random() * 40; 
                if (berryX > 20 && berryX < VIEW_WIDTH - 20) {
                    this.berries.push({ x: berryX, y: berryY, w: 30, h: 30, baseY: berryY, state: 0 });
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
                    this.solids.push({ x: subX, y: subY, w: subW, h: subH });
                }
            }

            // Springs on Solids
            if (Math.random() < 0.15) {
                const springX = x + Math.floor(Math.random() * wTiles) * TILE_SIZE;
                // Ensure clear space above
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
                
                let valid = false;
                if (springX >= 0 && springX < VIEW_WIDTH) {
                    if (side === 'right') {
                        if (this.isSolidAt(springX - TILE_SIZE, springY)) valid = true;
                    } else {
                        if (this.isSolidAt(springX + TILE_SIZE, springY)) valid = true;
                    }
                }

                if (valid) {
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

        // --- 3. One-way Platform Generation ---
        const wTiles = 3 + Math.floor(Math.random() * 3);
        const wP = wTiles * TILE_SIZE;
        const maxCol = Math.floor((VIEW_WIDTH - wP) / TILE_SIZE);
        const col = Math.floor(Math.random() * maxCol);
        const xP = col * TILE_SIZE;
        
        if (!this.checkSolidOverlap(xP, currentY, wP, TILE_SIZE)) {
            this.platforms.push({ x: xP, y: currentY, w: wP, h: 14 });
            if (Math.random() > 0.8) {
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

    checkWallOverlap(offset: number): boolean {
        const p = this.player;
        const rect = { x: p.x + offset, y: p.y, w: p.w, h: p.h };
        for (const s of this.solids) {
            if (this.AABB(rect, s)) return true;
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
        // Seam snagging fix: smaller height check
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h - 6 };
        
        for (const s of this.solids) {
            if (this.AABB(rect, s)) {
                // "Step Up" Logic
                const stepY = p.y - 4;
                const stepRect = { x: p.x, y: stepY, w: p.w, h: p.h };
                let stepCollision = false;
                
                for(const otherS of this.solids) {
                    if(this.AABB(stepRect, otherS)) {
                        stepCollision = true; break;
                    }
                }
                
                if (!stepCollision) {
                    p.y -= 4; 
                    continue; 
                }

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
                this.vibrate(30); 
                s.animTimer = 0.2;
                
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
                    this.vibrate(50); 
                    this.hitStop = 0.12; 
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

    update(dt: number, input: { dir: number, jump: boolean, dash: boolean, jumpHeld: boolean }) {
        if (this.state === GameState.PAUSED) return;

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
                         p.endTime = Date.now();
                         this.onGameOver(p.highestY, p.score, p.highestY > this.highScore, p.endTime - p.startTime);
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
        if(p.blinkTimer > 0) p.blinkTimer -= dt;
        else if (Math.random() < 0.01) p.blinkTimer = 0.15;

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
            this.onScoreUpdate(h, p.score, isRecord, Date.now() - p.startTime, p.followingBerries.length);
            
            if (isRecord && !p.hasTriggeredRecord && h < this.highScore + 50) {
                 this.onMilestone("NEW RECORD!!", true);
                 p.hasTriggeredRecord = true;
            }
            if (h >= p.lastMilestone + 1000) {
                p.lastMilestone = Math.floor(h / 1000) * 1000;
                this.onMilestone(p.lastMilestone + "m", false);
                this.setChapter(p.lastMilestone);
            }
        } else {
             this.onScoreUpdate(p.highestY, p.score, isRecord, Date.now() - p.startTime, p.followingBerries.length);
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

        const MAX_STEP = 0.01; 
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
            p.settleTimer = 0; 
        }
        if (wasGrounded && !p.grounded) {
            p.settleTimer = 0; 
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

        // Combo Logic
        if (p.grounded && p.followingBerries.length > 0) {
            p.settleTimer += dt;
            if (p.settleTimer > 1.0) { 
                const expected = Math.floor((p.settleTimer - 1.0) / 0.15) + 1;
                const countCollected = p.settleStreak;
                
                if (expected > countCollected) {
                    const b = p.followingBerries.shift();
                    if (b) {
                        b.state = 2;
                        p.score++;
                        p.settleStreak++;
                        sfx.play('berry', p.settleStreak); 
                        this.spawnEffect(p.x + 12, p.y + 12, COLORS.berry, 8);
                        this.spawnRipple(p.x + 12, p.y + 12);
                    }
                }
            } else {
                p.settleStreak = 0; 
            }
        } else {
             if (!p.grounded && p.followingBerries.length === 0) {
                 p.settleStreak = 0;
                 p.settleTimer = 0;
            }
        }

        // Snapshot Trail Logic
        if (p.isDashing) {
            if (Math.random() > 0.2) {
                p.trail.push({
                    x: p.x, y: p.y, 
                    alpha: 0.8, sprite: true, frame: { faceDir: p.faceDir, sx: p.sx, sy: p.sy }
                });
            }
        }
        for(let i = p.trail.length - 1; i >= 0; i--) {
            p.trail[i].alpha -= 0.1;
            if (p.trail[i].alpha <= 0) p.trail.splice(i, 1);
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
    updatePhysicsSubStep(dt: number, input: { dir: number, jump: boolean, dash: boolean, jumpHeld: boolean }) {
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
            this.vibrate(15); 
            p.dashBuffer = 0; 
            p.trail = []; 
            p.moveTimer = 0; // Reset movement accel on dash
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

            // Custom Curve Logic
            if (inputX !== 0) {
                // Acceleration: Ease-In (Slow then Fast)
                // If changing direction or starting from stop, reset timer
                if (Math.sign(inputX) !== Math.sign(p.vx) && p.vx !== 0) {
                    p.moveTimer = 0;
                    p.vx = 0; 
                }
                
                p.moveTimer += dt;
                const t = Math.min(p.moveTimer / ACCEL_TIME, 1.0);
                
                // Curve: t^2 (Quadratic Ease-In)
                const speedFactor = t * t;
                const targetSpeed = MAX_SPEED * speedFactor * inputX;
                
                // Only override velocity if we are "accelerating" up to max speed.
                if (Math.abs(p.vx) <= MAX_SPEED) {
                     p.vx = targetSpeed;
                } else {
                     // We are moving faster than max speed (e.g. spring), apply friction
                     const f = Math.pow(0.02, dt); 
                     p.vx += (targetSpeed - p.vx) * (1-f);
                }

            } else {
                // Deceleration: Fast then Slow (Exponential Decay)
                p.moveTimer = 0;
                
                // Allow wall jump momentum to carry further by reducing friction when locked
                const frictionTime = p.wallJumpTimer > 0 ? 0.4 : DECEL_TIME; 

                const stopFriction = Math.pow(0.001, dt / frictionTime); 
                p.vx *= stopFriction;
                if (Math.abs(p.vx) < 5) p.vx = 0;
            }
            
            // Gravity
            p.vy += GRAVITY * dt;

            // Variable Jump Height logic REMOVED for consistency
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
                
                // CORNER CORRECTION (Y-Axis) - 12px Tolerance
                if (overlapLeft < 12) {
                     p.x = s.x - p.w - 0.1; // Push out left
                     // DO NOT STOP Y here, allow slide
                } else if (overlapRight < 12) {
                     p.x = s.x + s.w + 0.1; // Push out right
                } else {
                    // Solid collision
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

    die() {
        if (this.state === GameState.DYING) return;
        this.state = GameState.DYING;
        
        // Stop the final timer immediately
        this.player.endTime = Date.now();
        this.onGameOver(this.player.highestY, this.player.score, this.player.highestY > this.highScore, this.player.endTime - this.player.startTime);
        
        sfx.play('death');
        this.shake = 10;
        this.vibrate(200);
        
        this.deathRipple.active = true;
        this.deathRipple.x = this.player.x + 12;
        this.deathRipple.y = this.player.y + 12;
        this.deathRipple.r = 0;
        
        // Match dash state color (Pale versions)
        if (this.player.isDashing) {
             this.deathRipple.color = '#ffffff'; // White
        } else if (this.player.canDash) {
             this.deathRipple.color = '#ff80a6'; // Pale Red
        } else {
             this.deathRipple.color = '#8cd5ff'; // Pale Blue
        }
    }

    drawTiledRect(x: number, y: number, w: number, h: number) {
        if (!this.tilesetImg) return;
        const ctx = this.ctx;
        const TS = TILE_SIZE;
        
        for(let cx = x; cx < x + w; cx += TS) {
            for(let cy = y; cy < y + h; cy += TS) {
                const u = this.isSolidAt(cx, cy - TS);
                const d = this.isSolidAt(cx, cy + TS);
                const l = this.isSolidAt(cx - TS, cy);
                const r = this.isSolidAt(cx + TS, cy);

                let srcX = 24; 
                if (!l && r) srcX = 0; 
                else if (l && !r) srcX = 48;
                else if (!l && !r) srcX = 72;

                let srcY = 24; 
                if (!u) srcY = 0;
                else if (!d) srcY = 48;
                
                if (h <= TS) srcY = 72; 

                ctx.drawImage(this.tilesetImg, srcX, srcY, TS, TS, Math.floor(cx), Math.floor(cy), TS, TS);
            }
        }
    }

    drawPlayer(ctx: CanvasRenderingContext2D) {
        const p = this.player;
        ctx.save();
        // Fix floating: Align body bottom (y+6) to hitbox bottom (y+12)
        // Hitbox is 24x24. Center is 12,12.
        ctx.translate(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h / 2));
        ctx.scale(p.sx * p.faceDir, p.sy);

        const color = p.isDashing ? COLORS.hairDash : (p.canDash ? COLORS.hairIdle : COLORS.hairNoDash);
        if (p.flashTimer > 0) ctx.fillStyle = '#ffffff';
        else ctx.fillStyle = color;

        // Hair (-10, -8, 20, 20)
        ctx.fillRect(-10, -8, 20, 20); 
        
        // Body (-6, 0, 12, 12) -> Feet at 12
        ctx.fillStyle = p.flashTimer > 0 ? '#ffffff' : color;
        ctx.fillRect(-6, 0, 12, 12); 
        
        // Eyes
        if (p.blinkTimer <= 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(1, -2, 2, 4); 
            ctx.fillRect(5, -2, 2, 4); 
        }

        ctx.restore();
    }

    draw() {
        const ctx = this.ctx;
        const p = this.player;

        // Clear
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Shake
        ctx.save();
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * this.shake * 2;
            const dy = (Math.random() - 0.5) * this.shake * 2;
            ctx.translate(Math.floor(dx), Math.floor(dy));
            this.shake = Math.max(0, this.shake - 1); // Decay shake
        }

        // Parallax BG
        if (this.bgImg) {
            // The SVG is 552x960. Tile it vertically.
            const bgY = Math.floor(this.cameraY * 0.5) % 960;
            ctx.drawImage(this.bgImg, 0, -bgY, VIEW_WIDTH, 960);
            ctx.drawImage(this.bgImg, 0, -bgY + 960, VIEW_WIDTH, 960);
            ctx.drawImage(this.bgImg, 0, -bgY - 960, VIEW_WIDTH, 960);
        }

        // Camera Transform
        ctx.translate(0, Math.floor(-this.cameraY));

        // Draw Solids
        this.solids.forEach(s => {
            this.drawTiledRect(s.x, s.y, s.w, s.h);
        });

        // Draw Platforms
        this.platforms.forEach(pl => {
            if (this.platformImg) {
                 for(let i=0; i<pl.w; i+=24) {
                     ctx.drawImage(this.platformImg, pl.x + i, pl.y, 24, 14);
                 }
            } else {
                ctx.fillStyle = COLORS.rock;
                ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
            }
        });

        // Springs
        this.springs.forEach(s => {
             if (this.springImg) {
                 ctx.save();
                 ctx.translate(s.x + 12, s.y + 12);
                 if (s.dir === 'left') ctx.rotate(-Math.PI/2);
                 if (s.dir === 'right') ctx.rotate(Math.PI/2);
                 
                 // Animation compression
                 const scale = 1 + (s.animTimer > 0 ? 0.4 : 0);
                 const off = s.animTimer > 0 ? -4 : 0;
                 
                 ctx.drawImage(this.springImg, -12, -12 + off, 24, 24);
                 ctx.restore();
             }
        });

        // Crystals
        this.crystals.forEach(c => {
            if (c.respawnTimer > 0) {
                 // GHOST OUTLINE (New)
                 ctx.save();
                 ctx.strokeStyle = COLORS.crystal;
                 ctx.lineWidth = 2;
                 ctx.setLineDash([4, 4]);
                 
                 const cx = c.x + c.w/2;
                 const cy = c.y + c.h/2;
                 
                 ctx.beginPath();
                 ctx.moveTo(cx, cy - 8);
                 ctx.lineTo(cx + 8, cy);
                 ctx.lineTo(cx, cy + 8);
                 ctx.lineTo(cx - 8, cy);
                 ctx.closePath();
                 ctx.stroke();
                 ctx.restore();
                 return;
            }
            // Bobbing (Slower)
            const bob = Math.sin(Date.now() / 500) * 2; 
            ctx.fillStyle = COLORS.crystal;
            // Draw Diamond shape
            const cx = c.x + c.w/2;
            const cy = c.y + c.h/2 + bob;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx + 8, cy);
            ctx.lineTo(cx, cy + 8);
            ctx.lineTo(cx - 8, cy);
            ctx.fill();
            
            // Glow
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(cx, cy, 12 + Math.sin(Date.now()/100)*2, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // Berries
        this.berries.forEach(b => {
             if (b.state === 2) return;
             if (this.berryImg) {
                 const bob = b.state === 0 ? Math.sin(Date.now()/250) * 3 : 0;
                 ctx.drawImage(this.berryImg, b.x, b.y + bob, 30, 30);
             }
        });

        // Player Trail
        p.trail.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.alpha * 0.5;
            ctx.translate(Math.floor(t.x + 12), Math.floor(t.y + 12));
            ctx.scale(t.frame.sx * t.frame.faceDir, t.frame.sy);
            ctx.fillStyle = COLORS.hairDash;
            ctx.fillRect(-10, -8, 20, 20); // Match player hair
            ctx.fillRect(-6, 0, 12, 12);   // Match player body
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        // Player
        if (this.state !== GameState.GAMEOVER && this.state !== GameState.DYING) {
             this.drawPlayer(ctx);
        }

        // Particles
        this.particles.forEach(pt => {
             ctx.fillStyle = pt.color;
             ctx.fillRect(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.size), Math.floor(pt.size));
        });

        // Ripples
        ctx.lineWidth = 2;
        this.ripples.forEach(r => {
             ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
             ctx.beginPath();
             ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
             ctx.stroke();
        });

        // Death Ripple
        if (this.deathRipple.active) {
            ctx.fillStyle = this.deathRipple.color;
            ctx.beginPath();
            ctx.arc(this.deathRipple.x, this.deathRipple.y, this.deathRipple.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Snow (Foreground)
        ctx.fillStyle = 'white';
        this.snow.forEach(s => {
             ctx.globalAlpha = 0.6;
             ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.floor(s.size), Math.floor(s.size));
        });
        ctx.globalAlpha = 1;

        ctx.restore(); // Pop Camera
        ctx.restore(); // Pop Shake
    }
}
