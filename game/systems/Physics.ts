import { GameEngine } from '../GameEngine';
import { Rect, Platform, Solid } from '../../types';
import { GRAVITY, MAX_FALL_SPEED, DASH_TIME, DASH_SPEED, MAX_SPEED, ACCEL_TIME, DECEL_TIME, WALL_SLIDE_SPEED, WALL_JUMP_X, WALL_JUMP_Y, WALL_BOUNCE_X, WALL_BOUNCE_Y, JUMP_FORCE, SPRING_SPEED_Y, SPRING_SPEED_X, SPRING_SIDE_LIFT, COLORS, TILE_SIZE } from '../../constants';
import { sfx } from '../../services/audioService';

export class Physics {
    
    AABB(r1: Rect, r2: Rect, pad: number = 0) {
        return r1.x < r2.x + r2.w + pad &&
               r1.x + r1.w > r2.x - pad &&
               r1.y < r2.y + r2.h + pad &&
               r1.y + r1.h > r2.y - pad;
    }

    checkBounds(p: any) {
        if (p.x < 0) { p.x = 0; p.vx = 0; }
        // Use game constant in future, but fixed width for now
        if (p.x + p.w > 480) { p.x = 480 - p.w; p.vx = 0; }
    }

    spawnEffect(game: GameEngine, x: number, y: number, c: string, n: number = 8, sizeBase: number = 5) {
        for (let i = 0; i < n; i++) {
            game.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1,
                color: c,
                size: Math.random() * sizeBase + (sizeBase * 0.5)
            });
        }
    }

    spawnRipple(game: GameEngine, x: number, y: number) {
        game.ripples.push({ x, y, r: 5, alpha: 1 });
    }

    // Helper to determine if a block is "exposed" at the bottom
    hasSolidBelow(game: GameEngine, s: Solid): boolean {
        const checkX = s.x + s.w / 2;
        const checkY = s.y + s.h + 2; // Check slightly below
        for (const other of game.solids) {
            if (other === s) continue;
            // Simple point check is enough for grid-aligned blocks
            if (checkX >= other.x && checkX <= other.x + other.w &&
                checkY >= other.y && checkY <= other.y + other.h) {
                return true;
            }
        }
        return false;
    }

    triggerNeighbors(game: GameEngine, s: Solid) {
        // Expand bounding box slightly to catch adjacent blocks
        const pad = 2;
        const triggerRect = { x: s.x - pad, y: s.y - pad, w: s.w + pad*2, h: s.h + pad*2 };

        for (const other of game.solids) {
            if (other === s) continue;
            if (other.crumbling && !other.shaking && !other.falling) {
                if (this.AABB(triggerRect, other)) {
                    other.shaking = true;
                    other.shakeTimer = 0.5;
                    // Daisy chain: Neighbors trigger THEIR neighbors after another 0.15s
                    other.neighborDelay = 0.15; 
                }
            }
        }
    }

    // Start a dash immediately (used for crystal buffering)
    startDash(game: GameEngine, dir: number) {
        const p = game.player;
        let dx = 0; let dy = -1;
        if (dir !== 0) { dx = dir * 0.707; dy = -0.707; }
        
        p.isDashing = true; p.canDash = false; p.dashTimer = DASH_TIME;
        p.jumpBuffer = 0; p.coyoteTimer = 0; p.grounded = false;
        p.vx = dx * DASH_SPEED; p.vy = dy * DASH_SPEED;
        game.hitStop = 0.05; p.dashDx = dx; p.dashDy = dy;
        p.sx = 0.6; p.sy = 1.4; sfx.play('dash'); game.shake = 6;
        game.vibrate(15); 
        p.dashBuffer = 0; 
        p.trail = []; 
        p.moveTimer = 0;
        p.springTimer = 0; 
    }

    updateSolids(game: GameEngine, dt: number) {
        for (const s of game.solids) {
            if (s.crumbling) {
                // Optimization: Only spawn snow if there is NO block directly underneath
                if (!s.falling && Math.random() < 0.15) { 
                    if (!this.hasSolidBelow(game, s)) {
                        game.particles.push({
                            x: s.x + Math.random() * s.w,
                            y: s.y + s.h,
                            vx: (Math.random() - 0.5) * 20,
                            vy: 60 + Math.random() * 40,
                            size: Math.random() * 2 + 1,
                            life: 0.3, 
                            color: '#ffffff'
                        });
                    }
                }

                if (s.shaking) {
                    s.shakeTimer = (s.shakeTimer || 0) - dt;
                    if (s.shakeTimer <= 0) {
                        s.shaking = false;
                        s.falling = true;
                        s.vy = 0;
                        game.vibrate(50);
                    }

                    if (s.neighborDelay !== undefined && s.neighborDelay > 0) {
                        s.neighborDelay -= dt;
                        if (s.neighborDelay <= 0) {
                            this.triggerNeighbors(game, s);
                            s.neighborDelay = undefined; 
                        }
                    }
                } else if (s.falling) {
                    const fallSpeed = (s.vy || 0) + (GRAVITY * 1.5) * dt;
                    s.vy = fallSpeed;
                    const dy = fallSpeed * dt;
                    s.y += dy;

                    // --- CARRY ENTITIES ---
                    // Move Springs
                    for (const sp of game.springs) {
                        // Check Top Attachment (Up Springs)
                        if (sp.dir === 'up') {
                            if (Math.abs(sp.y - (s.y - dy - sp.h)) < 2 && // Previously sitting on top
                                sp.x + sp.w > s.x && sp.x < s.x + s.w) {
                                sp.y += dy;
                            }
                        }
                        // Check Side Attachment
                        else if (sp.dir === 'left') {
                            if (Math.abs((sp.x + sp.w) - s.x) < 2 && 
                                sp.y + sp.h > s.y && sp.y < s.y + s.h) {
                                sp.y += dy;
                            }
                        } else if (sp.dir === 'right') {
                            if (Math.abs(sp.x - (s.x + s.w)) < 2 && 
                                sp.y + sp.h > s.y && sp.y < s.y + s.h) {
                                sp.y += dy;
                            }
                        }
                    }

                    // Move Flags (if sitting on a crumbling block for some reason)
                    for (const f of game.flags) {
                        if (f.y + f.h >= s.y - dy - 2 && f.y + f.h <= s.y - dy + 2 &&
                            f.x + f.w > s.x && f.x < s.x + s.w) {
                             f.y += dy;
                        }
                    }
                }
            }
        }
        
        // Cleanup fallen solids (optimization)
        const limit = game.cameraY + game.viewHeight + 200;
        game.solids = game.solids.filter(s => s.y < limit);
    }

    resolveSolidsX(p: any, solids: Solid[]) {
        const trunkMargin = 7;
        const trunkTop = p.y + trunkMargin;
        const trunkBottom = p.y + p.h - trunkMargin;
        const rect = { x: p.x, y: trunkTop, w: p.w, h: trunkBottom - trunkTop };
        
        for (const s of solids) {
            if (s.y >= p.y + p.h - 4) continue;
            if (s.y + s.h <= p.y + 4) continue;

            if (this.AABB(rect, s)) {
                const cx = p.x + p.w/2;
                const scx = s.x + s.w/2;
                
                if (p.vy >= -200) { 
                    const stepMax = 6;
                    const solidTop = s.y;
                    const diff = (p.y + p.h) - solidTop;
                    
                    if (diff > 0 && diff <= stepMax) {
                        p.y = solidTop - p.h - 0.1;
                        continue; 
                    }
                }

                if (p.vx > 0) {
                    p.x = s.x - p.w;
                    p.vx = 0;
                } else if (p.vx < 0) {
                    p.x = s.x + s.w;
                    p.vx = 0;
                } else {
                    if (cx < scx) p.x = s.x - p.w;
                    else p.x = s.x + s.w;
                }
            }
        }
    }

    checkPlatformCollisions(p: any, platforms: Platform[]) {
        if (p.vy < 0) return;
        
        for (const pl of platforms) {
            if (p.x + p.w > pl.x && p.x < pl.x + pl.w) {
                if (p.y + p.h >= pl.y && p.y + p.h <= pl.y + 10) {
                    p.y = pl.y - p.h;
                    p.vy = 0;
                    p.grounded = true;
                }
            }
        }
    }

    checkWallOverlap(p: any, solids: Solid[], offset: number): boolean {
        const trunkMargin = 7;
        const trunkTop = p.y + trunkMargin;
        const trunkBottom = p.y + p.h - trunkMargin;
        const rect = { x: p.x + offset, y: trunkTop, w: p.w, h: trunkBottom - trunkTop };
        
        for (const s of solids) {
            if (s.y >= p.y + p.h - 4) continue;
            if (this.AABB(rect, s)) return true;
        }
        return false;
    }

    update(game: GameEngine, dt: number, input: { dir: number, jump: boolean, dash: boolean, jumpHeld: boolean }) {
        this.updateSolids(game, dt);

        const p = game.player;

        // Wall Bounce (Super Jump)
        if (p.jumpBuffer > 0 && p.wallBounceTimer > 0) {
            let wbDir = 0;
            const checkRect = { x: p.x - 12, y: p.y, w: p.w + 24, h: p.h };
            for (const s of game.solids) {
                if (this.AABB(checkRect, s)) {
                    wbDir = (s.x > p.x) ? 1 : -1;
                    break;
                }
            }
            if (wbDir !== 0) {
                p.jumpBuffer = 0; p.wallBounceTimer = 0; p.isDashing = false; p.dashTimer = 0;
                
                // Physics: Wall Bounce
                // REWARD LATE TIMING: Snap vertical velocity to MAX DASH SPEED.
                p.vy = Math.min(p.vy, -DASH_SPEED); 
                p.vx = -wbDir * WALL_BOUNCE_X; 
                
                // Input lock
                if (input.dir === wbDir || input.dir === 0) p.wallJumpTimer = 0.10; else p.wallJumpTimer = 0;
                
                p.sx = 0.5; p.sy = 1.5;
                p.flashTimer = 0.1; 
                sfx.play('bounce'); 
                this.spawnRipple(game, p.x + p.w / 2, p.y + p.h / 2);
                return; 
            }
        }

        if (input.dash && p.canDash && !p.isDashing) {
            this.startDash(game, input.dir);
        }

        if (p.isDashing) {
            p.dashTimer -= dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false; 
                
                // DASH END SNAP:
                if (!p.grounded) {
                    if (p.vy < 0) p.vy *= 0.6; // Vertical cut
                    
                    // Horizontal cut
                    if (Math.abs(p.vx) > MAX_SPEED) {
                        p.vx = Math.sign(p.vx) * Math.max(Math.abs(p.vx) * 0.65, MAX_SPEED);
                    }
                }
            }
        } else {
            let inputX = input.dir;
            if (p.wallJumpTimer > 0) inputX = 0;
            if (inputX !== 0) p.faceDir = inputX;

            if (p.springTimer > 0) {
                if ((p.vx > 0 && inputX < 0) || (p.vx < 0 && inputX > 0)) {
                    inputX = 0;
                }
            }

            if (inputX !== 0) {
                p.springTimer = 0; 
                if (Math.sign(inputX) !== Math.sign(p.vx) && p.vx !== 0) {
                    p.moveTimer = 0;
                    p.vx = 0; 
                }
                
                p.moveTimer += dt;
                const t = Math.min(p.moveTimer / ACCEL_TIME, 1.0);
                const speedFactor = t * t;
                const targetSpeed = MAX_SPEED * speedFactor * inputX;
                
                if (Math.abs(p.vx) <= MAX_SPEED) {
                     p.vx = targetSpeed;
                } else {
                     // SMART SUPER SPEED FRICTION:
                     let f = 0.9; // Default brake
                     if (Math.sign(inputX) === Math.sign(p.vx)) {
                         f = Math.pow(0.5, dt); // Retain momentum (Slide)
                     } else {
                         f = Math.pow(0.001, dt); // Brake hard
                     }
                     
                     p.vx += (targetSpeed - p.vx) * (1-f);
                }

            } else {
                p.moveTimer = 0;
                if (p.springTimer > 0) {
                    p.vx *= Math.pow(0.98, dt * 60); 
                } else {
                    const frictionTime = (p.wallJumpTimer > 0) ? 0.4 : DECEL_TIME; 
                    const stopFriction = Math.pow(0.001, dt / frictionTime); 
                    p.vx *= stopFriction;
                }
                if (Math.abs(p.vx) < 5) p.vx = 0;
            }
            
            p.vy += GRAVITY * dt;
            if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;
        }

        if (!p.isDashing) {
            p.onWall = 0;
            if (this.checkWallOverlap(p, game.solids, -2)) p.onWall = -1;
            else if (this.checkWallOverlap(p, game.solids, 2)) p.onWall = 1;

            const pushingWall = (p.onWall === 1 && input.dir === 1) || (p.onWall === -1 && input.dir === -1);
            
            if (p.vy > 0 && pushingWall && !p.grounded) {
                if (p.vy > WALL_SLIDE_SPEED) p.vy = WALL_SLIDE_SPEED;
                if (Math.random() > 0.8) this.spawnEffect(game, p.onWall === 1 ? p.x + p.w : p.x, p.y + Math.random() * p.h, '#fff', 1, 2);
            }

            if (p.jumpBuffer > 0) {
                if (p.grounded || p.coyoteTimer > 0) {
                    p.vy = JUMP_FORCE; p.grounded = false; p.coyoteTimer = 0; p.jumpBuffer = 0;
                    p.sx = 0.6; p.sy = 1.4; sfx.play('jump');
                } else if (p.onWall !== 0) {
                    // Standard Wall Jump (Kick)
                    p.vy = WALL_JUMP_Y; p.vx = -p.onWall * WALL_JUMP_X;
                    // Standard lock (0.15s)
                    if (input.dir === p.onWall || input.dir === 0) p.wallJumpTimer = 0.15; else p.wallJumpTimer = 0;
                    p.jumpBuffer = 0; p.onWall = 0; sfx.play('jump');
                    p.sx = 0.6; p.sy = 1.4;
                }
            }
        }

        p.x += p.vx * dt;
        this.resolveSolidsX(p, game.solids);
        this.checkBounds(p); 

        p.y += p.vy * dt;
        p.grounded = false; 
        
        if (!p.isDashing && p.vy > 0) {
            this.checkPlatformCollisions(p, game.platforms);
        }

        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        for (const s of game.solids) {
            if (this.AABB(rect, s)) {
                const overlapLeft = (p.x + p.w) - s.x;
                const overlapRight = (s.x + s.w) - p.x;
                const overlapTop = (p.y + p.h) - s.y;
                const overlapBottom = (s.y + s.h) - p.y;
                
                if (p.vy >= 0 && overlapTop < 20) {
                     p.y = s.y - p.h;
                     p.vy = 0;
                     p.grounded = true;
                     
                     if (s.crumbling && !s.shaking && !s.falling) {
                         s.shaking = true;
                         s.shakeTimer = 0.5; 
                         s.neighborDelay = 0.15; 
                     }
                } 
                else if (p.vy < 0 && overlapBottom < 20) {
                    const CORNER_CORRECTION = 12;
                    let corrected = false;
                    
                    if (overlapLeft <= CORNER_CORRECTION) {
                         p.x = s.x - p.w - 0.1; 
                         corrected = true;
                    } 
                    else if (overlapRight <= CORNER_CORRECTION) {
                         p.x = s.x + s.w + 0.1; 
                         corrected = true;
                    }

                    if (!corrected) {
                         p.y = s.y + s.h;
                         p.vy = 0;
                    }
                }
            }
        }

        if (p.grounded) {
            p.canDash = true; 
        }

        this.checkEntityCollisions(game, input);
    }

    checkEntityCollisions(game: GameEngine, input: { dir: number }) {
        const p = game.player;
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        
        // RESTORE FLAG COLLISION AS FAILSAFE
        for (const f of game.flags) {
            if (this.AABB(rect, f)) {
                game.completeLevel();
                return; 
            }
        }

        for (const c of game.crystals) {
            if (c.respawnTimer <= 0 && this.AABB(rect, c)) {
                const dashQueued = p.dashBuffer > 0;
                
                if (!p.canDash || dashQueued) {
                    p.canDash = true;
                    c.respawnTimer = 2.5;
                    sfx.play('crystal');
                    game.vibrate(50); 
                    game.hitStop = 0.12; 
                    game.shake = 4;
                    p.flashTimer = 0.1;
                    this.spawnEffect(game, c.x + c.w/2, c.y + c.h/2, COLORS.crystal, 5);

                    // INSTANT DASH: If player pre-buffered dash, execute immediately
                    if (dashQueued) {
                         // We need dash direction. If buffered, use current input direction
                         this.startDash(game, input.dir);
                    }
                }
            }
        }

        for (const b of game.berries) {
            if (b.state === 0 && this.AABB(rect, b)) {
                b.state = 1;
                p.followingBerries.push(b);
                sfx.play('berry', p.followingBerries.length); 
            }
        }
        
        for (const s of game.springs) {
            if (this.AABB(rect, { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 12 })) {
                sfx.play('spring');
                game.vibrate(30); 
                s.animTimer = 0.2;
                
                if (!p.canDash) {
                    p.canDash = true; 
                    p.flashTimer = 0.1;
                }
                
                p.isDashing = false;
                p.dashTimer = 0;
                
                if (s.dir === 'up') {
                    p.x = s.x; 
                    p.vy = SPRING_SPEED_Y;
                    p.sx = 0.5; p.sy = 1.5; 
                } else if (s.dir === 'left') {
                    p.y = s.y; 
                    p.vx = -SPRING_SPEED_X;
                    p.vy = SPRING_SIDE_LIFT; 
                    p.faceDir = -1;
                    p.sx = 1.5; p.sy = 0.5; 
                    p.springTimer = 0.5; 
                } else if (s.dir === 'right') {
                    p.y = s.y; 
                    p.vx = SPRING_SPEED_X;
                    p.vy = SPRING_SIDE_LIFT;
                    p.faceDir = 1;
                    p.sx = 1.5; p.sy = 0.5;
                    p.springTimer = 0.5; 
                }
            }
        }
    }
}