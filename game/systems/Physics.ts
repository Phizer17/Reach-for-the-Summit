import { GameEngine } from '../GameEngine';
import { Rect, Platform, Solid } from '../../types';
import { GRAVITY, MAX_FALL_SPEED, DASH_TIME, DASH_SPEED, MAX_SPEED, ACCEL_TIME, DECEL_TIME, WALL_SLIDE_SPEED, WALL_JUMP_X, WALL_JUMP_Y, JUMP_FORCE, SPRING_SPEED_Y, SPRING_SPEED_X, SPRING_SIDE_LIFT, COLORS } from '../../constants';
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

    spawnEffect(game: GameEngine, x: number, y: number, c: string, n: number = 8) {
        for (let i = 0; i < n; i++) {
            game.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1,
                color: c,
                size: Math.random() * 5 + 3
            });
        }
    }

    spawnRipple(game: GameEngine, x: number, y: number) {
        game.ripples.push({ x, y, r: 5, alpha: 1 });
    }

    resolveSolidsX(p: any, solids: Solid[]) {
        // AABB FIX: Very strict vertical bounds to prevent corner snagging
        // We only check for walls if the wall overlaps the player's "trunk"
        // p.y + 10 to p.y + p.h - 10.
        const trunkTop = p.y + 8;
        const trunkBottom = p.y + p.h - 8;
        const rect = { x: p.x, y: trunkTop, w: p.w, h: trunkBottom - trunkTop };
        
        for (const s of solids) {
            // Ignore floors completely
            if (s.y >= p.y + p.h - 6) continue;

            if (this.AABB(rect, s)) {
                if (p.grounded) {
                    const stepY = p.y - 4;
                    const stepRect = { x: p.x, y: stepY + 8, w: p.w, h: trunkBottom - trunkTop };
                    let stepCollision = false;
                    
                    for(const otherS of solids) {
                        if (otherS.y >= p.y + p.h - 6) continue;
                        if(this.AABB(stepRect, otherS, -1)) {
                            stepCollision = true; break;
                        }
                    }
                    
                    if (!stepCollision) {
                        p.y -= 4; 
                        continue; 
                    }
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
        const trunkTop = p.y + 8;
        const trunkBottom = p.y + p.h - 8;
        const rect = { x: p.x + offset, y: trunkTop, w: p.w, h: trunkBottom - trunkTop };
        for (const s of solids) {
            if (s.y >= p.y + p.h - 6) continue;
            if (this.AABB(rect, s)) return true;
        }
        return false;
    }

    update(game: GameEngine, dt: number, input: { dir: number, jump: boolean, dash: boolean, jumpHeld: boolean }) {
        const p = game.player;

        // Wall Bounce
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
                p.vy = -950; p.vx = -wbDir * WALL_JUMP_X; 
                p.wallJumpTimer = 0.2; p.sx = 0.5; p.sy = 1.5;
                p.flashTimer = 0.1; 
                sfx.play('bounce'); 
                this.spawnRipple(game, p.x + p.w / 2, p.y + p.h / 2);
                return; 
            }
        }

        // Dash
        if (input.dash && p.canDash && !p.isDashing) {
            let dx = 0; let dy = -1;
            if (input.dir !== 0) { dx = input.dir * 0.707; dy = -0.707; }
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

        if (p.isDashing) {
            p.dashTimer -= dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false; p.vx *= 0.5; p.vy *= 0.5;
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

            // Movement
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
                     const f = Math.pow(0.02, dt); 
                     p.vx += (targetSpeed - p.vx) * (1-f);
                }

            } else {
                p.moveTimer = 0;
                // If hit spring, use very low friction to conserve momentum
                if (p.springTimer > 0) {
                    // Very slow decay for spring trajectory
                    p.vx *= Math.pow(0.98, dt * 60); 
                } else {
                    const frictionTime = (p.wallJumpTimer > 0) ? 0.4 : DECEL_TIME; 
                    const stopFriction = Math.pow(0.001, dt / frictionTime); 
                    p.vx *= stopFriction;
                }
                if (Math.abs(p.vx) < 5) p.vx = 0;
            }
            
            // Gravity
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
                if (Math.random() > 0.8) this.spawnEffect(game, p.onWall === 1 ? p.x + p.w : p.x, p.y + Math.random() * p.h, '#fff', 1);
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

        // Apply Velocity
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
                
                if (overlapLeft < 12) {
                     p.x = s.x - p.w - 0.1; 
                } else if (overlapRight < 12) {
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

        this.checkEntityCollisions(game);
    }

    checkEntityCollisions(game: GameEngine) {
        const p = game.player;
        const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
        
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
                    this.spawnEffect(game, c.x + 15, c.y + 15, COLORS.crystal, 5);
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
                
                p.canDash = true; 
                p.isDashing = false;
                p.dashTimer = 0;
                p.flashTimer = 0.1; 
                
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