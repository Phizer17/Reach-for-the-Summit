
import { GameState, Rect, Platform, Berry, Crystal, Solid, Particle, Spring, TrailPoint } from '../types';
import { COLORS, CHAPTERS, VIEW_WIDTH, TILE_SIZE, DASH_SPEED, JUMP_BUFFER_TIME } from '../constants';
import { sfx } from '../services/audioService';
import { Physics } from './systems/Physics';
import { LevelGenerator } from './systems/LevelGenerator';
import { Renderer } from './systems/Renderer';

export class GameEngine {
    state: GameState = GameState.TITLE;
    debug: boolean = false;
    
    // Systems
    physics: Physics;
    levelGen: LevelGenerator;
    renderer: Renderer;
    
    // Viewport
    viewHeight: number = 0;
    cameraY: number = 0;
    
    // Input State
    lastInputDir: number = 0;
    
    // Entities (State)
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
        springTimer: 0,
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
    
    // State Variables
    shake = 0;
    hitStop = 0;
    currentBg = [29, 29, 43];
    targetBg = [29, 29, 43];
    highScore = 0;

    // Visual State for Canvas Rendering
    milestone = {
        active: false,
        text: '',
        timer: 0,
        maxTimer: 3.0 // Increased for smoother fade
    };
    
    deathRipple = {
        active: false,
        x: 0,
        y: 0,
        r: 0,
        maxR: 0,
        color: '#fff'
    };
    
    // Callbacks
    onScoreUpdate: (height: number, berries: number, isRecord: boolean, time: number, pendingBerries: number, speed: string) => void;
    onGameOver: (height: number, berries: number, newRecord: boolean, time: number) => void;
    
    constructor(
        canvas: HTMLCanvasElement, 
        onScore: (h: number, b: number, rec: boolean, t: number, pb: number, s: string) => void,
        onOver: (h: number, b: number, rec: boolean, t: number) => void
    ) {
        this.renderer = new Renderer(canvas);
        this.physics = new Physics();
        this.levelGen = new LevelGenerator();

        this.onScoreUpdate = onScore;
        this.onGameOver = onOver;
        
        const saved = localStorage.getItem('dc_highscore');
        this.highScore = saved ? parseInt(saved) : 0;
        
        this.resize();
        this.initSnow();
    }

    resize() {
        this.renderer.resize(this.viewHeight);
        this.viewHeight = this.renderer.canvas.height;
        this.deathRipple.maxR = Math.sqrt(Math.pow(VIEW_WIDTH, 2) + Math.pow(this.viewHeight, 2));
    }

    vibrate(ms: number) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    triggerMilestone(text: string) {
        this.milestone.text = text;
        this.milestone.active = true;
        this.milestone.maxTimer = 3.0;
        this.milestone.timer = this.milestone.maxTimer; 
    }

    initGame() {
        this.platforms = [];
        this.berries = [];
        this.crystals = [];
        this.solids = [];
        this.springs = [];
        this.particles = [];
        this.ripples = [];
        
        this.levelGen.reset();
        this.levelGen.initStartPlatform(this.solids);
        
        this.player.x = VIEW_WIDTH / 2 - 12;
        // Spawn on Ground (150 - 24 = 126). 
        // 125.9 ensures we aren't embedded and physics can settle.
        this.player.y = 125.9; 
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.canDash = true;
        this.player.isDashing = false;
        this.player.grounded = true; // Start grounded
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
        this.player.springTimer = 0;
        this.player.hasTriggeredRecord = false;
        this.player.startTime = Date.now();
        this.player.endTime = 0;
        
        this.milestone.active = false;

        const saved = localStorage.getItem('dc_highscore');
        this.highScore = saved ? parseInt(saved) : 0;
        
        this.deathRipple.active = false;
        this.cameraY = -this.viewHeight / 2; // Initial camera
        
        // Adjust camera to look at player on start
        this.cameraY = this.player.y - this.viewHeight * 0.7;

        this.state = GameState.PLAYING;
        this.currentBg = [...this.targetBg];
        this.setChapter(0);
        
        for (let i = 0; i < 10; i++) this.levelGen.generate(this.solids, this.platforms, this.crystals, this.berries, this.springs);
        
        this.onScoreUpdate(0, 0, false, 0, 0, "0.00");
    }

    setChapter(h: number) {
        let idx = 0;
        for (let i = 0; i < CHAPTERS.length; i++) {
            if (h >= CHAPTERS[i].h) idx = i;
        }
        this.targetBg = CHAPTERS[idx].c;
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

    update(dt: number, input: { dir: number, jump: boolean, dash: boolean, jumpHeld: boolean }) {
        if (this.state === GameState.PAUSED) return;
        if (this.state === GameState.GAMEOVER) return;

        for (let i = 0; i < 3; i++) {
            this.currentBg[i] += (this.targetBg[i] - this.currentBg[i]) * 2 * dt;
        }
        
        if (this.milestone.active) {
            this.milestone.timer -= dt;
            if (this.milestone.timer <= 0) this.milestone.active = false;
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
                         this.onGameOver(p.highestY, p.score, p.highestY > this.highScore, p.endTime - p.startTime);
                         this.state = GameState.GAMEOVER;
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
        if(p.springTimer > 0) p.springTimer -= dt;

        if (input.dash && !p.canDash) {
            p.dashBuffer = JUMP_BUFFER_TIME; // 80ms buffer
        }

        // Camera Follow - Adjusted to keep player lower on screen (approx 70% from top)
        // This allows seeing more terrain above.
        // Screen top is 0. Player Y is in world space. CameraY is world Y of screen top.
        // We want CameraY to follow so that (PlayerY - CameraY) approx equals 0.65 * ViewHeight
        const targetY = p.y - this.viewHeight * 0.65; 
        if (targetY < this.cameraY) {
            this.cameraY += (targetY - this.cameraY) * 0.15;
        }

        // Height Calculation: 1 Tile (24px) = 1 Meter
        // Baseline is 150 (Ground Level). Up is Negative.
        // Height = (150 - currentY) / 24.
        const START_Y = 150;
        const h = Math.floor(Math.max(0, (START_Y - p.y) / TILE_SIZE));
        
        // Calculate AVERAGE speed (m/s)
        const elapsedSec = (Date.now() - p.startTime) / 1000;
        const avgSpeedVal = elapsedSec > 0 ? (h / elapsedSec) : 0;
        const speedStr = avgSpeedVal.toFixed(2);
        
        const isRecord = this.highScore > 0 && h > this.highScore;
        
        if (h > p.highestY) {
            p.highestY = h;
            this.onScoreUpdate(h, p.score, isRecord, Date.now() - p.startTime, p.followingBerries.length, speedStr);
            
            if (isRecord && !p.hasTriggeredRecord && h < this.highScore + 50) {
                 this.triggerMilestone("NEW RECORD");
                 sfx.play('record');
                 p.hasTriggeredRecord = true;
            }
            if (h >= p.lastMilestone + 500) {
                p.lastMilestone = Math.floor(h / 500) * 500;
                this.triggerMilestone(p.lastMilestone + "M");
                this.setChapter(p.lastMilestone);
            }
        } else {
             this.onScoreUpdate(p.highestY, p.score, isRecord, Date.now() - p.startTime, p.followingBerries.length, speedStr);
        }

        if (p.y > this.cameraY + this.viewHeight + 100) {
            this.die();
            return;
        }

        if (p.grounded) p.coyoteTimer = 0.1; else p.coyoteTimer -= dt;
        if (input.jump) p.jumpBuffer = JUMP_BUFFER_TIME; // 80ms
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
            // Dash triggers if dash pressed OR buffered
            const effectiveDash = input.dash || (p.dashBuffer > 0 && p.canDash);
            this.physics.update(this, step, { ...input, dash: effectiveDash });
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
                        this.physics.spawnEffect(this, p.x + 12, p.y + 12, COLORS.berry, 8);
                        this.physics.spawnRipple(this, p.x + 12, p.y + 12);
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
        
        while (this.levelGen.spawnY > this.cameraY - 200) {
            this.levelGen.generate(this.solids, this.platforms, this.crystals, this.berries, this.springs);
        }
        
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
                     const px = (c.x + c.w/2) + Math.cos(angle) * dist;
                     const py = (c.y + c.h/2) + Math.sin(angle) * dist;
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
                 this.physics.spawnRipple(this, c.x + c.w/2, c.y + c.h/2);
                 this.physics.spawnEffect(this, c.x + c.w/2, c.y + c.h/2, COLORS.crystal, 12);
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
        
        if (this.shake > 0) {
            this.shake -= 30 * dt;
            if (this.shake < 0) this.shake = 0;
        }
    }

    die() {
        if (this.state === GameState.DYING) return;
        this.state = GameState.DYING;
        
        this.player.endTime = Date.now();
        sfx.play('death');
        this.shake = 10;
        this.vibrate(200);
        
        this.deathRipple.active = true;
        this.deathRipple.x = this.player.x + 12;
        this.deathRipple.y = this.player.y + 12;
        this.deathRipple.r = 0;
        
        if (this.player.isDashing) {
             this.deathRipple.color = '#ffffff'; 
        } else if (this.player.canDash) {
             this.deathRipple.color = '#ff80a6'; 
        } else {
             this.deathRipple.color = '#8cd5ff'; 
        }
    }

    draw() {
        this.renderer.draw(this);
    }
}
