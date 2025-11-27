
import { GameEngine } from '../GameEngine';
import { COLORS, VIEW_WIDTH, TILE_SIZE } from '../../constants';
import { GameState } from '../../types';

export class Renderer {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    
    // Assets
    tilesetImg: HTMLImageElement | null = null;
    platformImg: HTMLImageElement | null = null;
    bgImg: HTMLImageElement | null = null;
    springImg: HTMLImageElement | null = null;
    berryImg: HTMLImageElement | null = null; 
    crystalImg: HTMLImageElement | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false;
        this.loadTextures();
    }

    resize(viewHeight: number) {
        this.canvas.width = VIEW_WIDTH;
        this.canvas.height = this.canvas.clientHeight * (VIEW_WIDTH / this.canvas.clientWidth);
        if(this.ctx) this.ctx.imageSmoothingEnabled = false;
    }

    loadTextures() {
        const c = { base: '#201c3b', mid: '#332c50', light: '#68c2d3', shadow: '#110d21', snow: '#ffffff', snowShade: '#8daac9' };
        
        // Tileset
        const tilesetSvg = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="rockPat" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${c.base}"/><path d="M0 24 L24 0" stroke="${c.mid}" stroke-width="6"/><path d="M-12 24 L12 0" stroke="${c.mid}" stroke-width="6"/><path d="M12 24 L36 0" stroke="${c.mid}" stroke-width="6"/><rect x="6" y="14" width="2" height="2" fill="${c.light}" opacity="0.3"/><rect x="16" y="4" width="2" height="2" fill="${c.light}" opacity="0.3"/></pattern></defs><rect width="96" height="96" fill="url(#rockPat)"/><g><rect x="0" y="0" width="2" height="96" fill="${c.light}"/><rect x="2" y="0" width="2" height="96" fill="${c.mid}" opacity="0.5"/></g><g transform="translate(48, 0)"><rect x="22" y="0" width="2" height="96" fill="${c.shadow}"/><rect x="20" y="0" width="2" height="96" fill="${c.shadow}" opacity="0.5"/></g><g transform="translate(72, 0)"><rect x="0" y="0" width="2" height="96" fill="${c.light}"/><rect x="22" y="0" width="2" height="96" fill="${c.shadow}"/></g><g><rect x="0" y="0" width="96" height="6" fill="${c.snow}"/><rect x="0" y="6" width="96" height="2" fill="${c.snowShade}"/><path d="M4 8 H8 V10 H4 Z" fill="${c.snow}"/><path d="M20 8 H26 V11 H20 Z" fill="${c.snow}"/><path d="M44 8 H48 V9 H44 Z" fill="${c.snow}"/><path d="M60 8 H66 V12 H60 Z" fill="${c.snow}"/><path d="M85 8 H88 V10 H85 Z" fill="${c.snow}"/><rect x="0" y="0" width="2" height="6" fill="${c.snow}"/><rect x="94" y="0" width="2" height="6" fill="${c.snow}"/></g><g transform="translate(0, 48)"><rect x="0" y="22" width="96" height="2" fill="${c.shadow}"/><rect x="0" y="20" width="96" height="2" fill="${c.shadow}" opacity="0.5"/></g><g transform="translate(0, 72)"><rect x="0" y="22" width="96" height="2" fill="${c.shadow}"/><rect x="0" y="20" width="96" height="2" fill="${c.shadow}" opacity="0.5"/><rect x="0" y="0" width="96" height="6" fill="${c.snow}"/><rect x="0" y="6" width="96" height="2" fill="${c.snowShade}"/></g></svg>`.trim();
        this.tilesetImg = new Image(); this.tilesetImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(tilesetSvg);

        // Platform
        const platformSvg = `<svg width="24" height="14" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="2" width="24" height="8" fill="#5c4436"/><rect x="0" y="2" width="24" height="2" fill="#82604d"/> <rect x="0" y="9" width="24" height="1" fill="#33251d"/> <rect x="4" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/><rect x="18" y="2" width="2" height="8" fill="#33251d" opacity="0.5"/><rect x="0" y="0" width="24" height="3" fill="#e8f7ff"/></svg>`.trim();
        this.platformImg = new Image(); this.platformImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(platformSvg);

        // Spring
        const springSvg = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="18" width="20" height="6" rx="2" fill="#555"/><rect x="3" y="19" width="18" height="4" fill="#333"/><path d="M4 18 L20 18 L4 14 L20 14 L4 10" stroke="#ccc" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="2" y="8" width="20" height="4" rx="1" fill="#e04040"/><rect x="4" y="9" width="16" height="2" fill="#ff6666"/></svg>`.trim();
        this.springImg = new Image(); this.springImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(springSvg);

        // BG
        const bgSvg = `<svg width="552" height="960" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#111221"/><stop offset="100%" stop-color="#282638"/></linearGradient></defs><rect width="552" height="960" fill="url(#sky)"/><path d="M0 960 L0 800 L100 700 L250 850 L400 720 L552 800 L552 960 Z" fill="#1b1b29"/><g fill="#fff" opacity="0.4"><circle cx="50" cy="100" r="1"/><circle cx="200" cy="50" r="1.5"/><circle cx="450" cy="150" r="1"/><circle cx="300" cy="300" r="1"/><circle cx="100" cy="400" r="1"/></g></svg>`.trim();
        this.bgImg = new Image(); this.bgImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(bgSvg);

        // Berry (Red) - REDUCED SPOTS TO 3
        const berrySvg = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21 C17 19 20 14 20 10 C20 7 18 5 12 5 C6 5 4 7 4 10 C4 14 7 19 12 21 Z" fill="${COLORS.berry}"/><circle cx="8" cy="10" r="1" fill="#fff" opacity="0.6"/><circle cx="14" cy="9" r="1" fill="#fff" opacity="0.6"/><circle cx="11" cy="14" r="1" fill="#fff" opacity="0.6"/><path d="M12 5 L9 3 L8 6 L12 8 L16 6 L15 3 Z" fill="#00e436"/></svg>`.trim();
        this.berryImg = new Image(); this.berryImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(berrySvg);

        // Crystal (Resized to 22x22 visually in a 22x22 box)
        const crystalSvg = `<svg width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="M11 2 L20 11 L11 20 L2 11 Z" fill="#00e436" opacity="0.8"/><path d="M11 5 L17 11 L11 17 L5 11 Z" fill="#80ff9d" opacity="0.6"/><path d="M11 2 L20 11 L11 20 L2 11 Z" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/></svg>`.trim();
        this.crystalImg = new Image(); this.crystalImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(crystalSvg);
    }

    // Helper to check solid existence with tolerance to fix seam issues
    isSolidAt(game: GameEngine, x: number, y: number): boolean {
        // Check point with slight inset to avoid boundary errors
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;
        for (const s of game.solids) {
            // Relaxed check: Use >= and <= slightly to catch exact edge matches if they are neighbors
            if (cx > s.x && cx < s.x + s.w &&
                cy > s.y && cy < s.y + s.h) {
                return true;
            }
        }
        return false;
    }

    drawTiledRect(game: GameEngine, x: number, y: number, w: number, h: number) {
        if (!this.tilesetImg) return;
        const ctx = this.ctx;
        const TS = TILE_SIZE;
        
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const endX = startX + w;
        const endY = startY + h;

        for(let cx = startX; cx < endX; cx += TS) {
            for(let cy = startY; cy < endY; cy += TS) {
                // Check neighbors using the specific grid positions
                // We add/subtract 2px to move safely into the neighbor cell
                const u = this.isSolidAt(game, cx, cy - TS + 2);
                const d = this.isSolidAt(game, cx, cy + TS - 2);
                const l = this.isSolidAt(game, cx - TS + 2, cy);
                const r = this.isSolidAt(game, cx + TS - 2, cy);

                let srcX = 24; 
                if (!l && r) srcX = 0; 
                else if (l && !r) srcX = 48;
                else if (!l && !r) srcX = 72;

                let srcY = 24; 
                // Seamless vertical blending:
                // If there is NO block above AND NO block below, use index 72 (Top+Bottom border).
                // If there is NO block above (but one below), use index 0 (Top border).
                // If there is NO block below (but one above), use index 48 (Bottom border).
                // Otherwise (blocks above and below), use index 24 (No borders, middle pattern).
                if (!u && !d) srcY = 72;
                else if (!u) srcY = 0;
                else if (!d) srcY = 48;
                else srcY = 24;

                ctx.drawImage(this.tilesetImg, srcX, srcY, TS, TS, cx, cy, TS, TS);
            }
        }
    }

    drawPlayer(game: GameEngine, p: any) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h / 2));
        
        // Draw Dash Direction Indicator (ALWAYS VISIBLE)
        if (game.state === GameState.PLAYING) {
             ctx.save();
             let dx = game.lastInputDir;
             let angle = -Math.PI / 2; 

             if (dx !== 0) {
                 angle = Math.atan2(-0.707, dx * 0.707);
             }
             
             const dist = 24;
             ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
             ctx.rotate(angle + Math.PI / 2);
             
             // Color indicates dash readiness
             // If dashing, show white; if can dash, white; if no dash, blueish
             // Per request: Always show.
             ctx.fillStyle = p.canDash ? '#ffffff' : '#8cd5ff';
             ctx.globalAlpha = p.isDashing ? 0.3 : 0.6; // Fade out slightly if actually dashing
             ctx.beginPath();
             ctx.moveTo(0, -4);
             ctx.lineTo(4, 4);
             ctx.lineTo(-4, 4);
             ctx.fill();
             ctx.restore();
        }

        ctx.scale(p.sx * p.faceDir, p.sy);

        const color = p.isDashing ? COLORS.hairDash : (p.canDash ? COLORS.hairIdle : COLORS.hairNoDash);
        if (p.flashTimer > 0) ctx.fillStyle = '#ffffff';
        else ctx.fillStyle = color;

        // Hair
        ctx.fillRect(-10, -8, 20, 20); 
        
        // Body
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

    drawDebug(game: GameEngine) {
        const ctx = this.ctx;
        const p = game.player;
        
        ctx.save();
        ctx.translate(0, Math.floor(-game.cameraY));
        
        // Solids
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        game.solids.forEach(s => {
            ctx.strokeRect(s.x, s.y, s.w, s.h);
        });
        
        // Platforms
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
        game.platforms.forEach(pl => {
            ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
        });
        
        // Player Hitbox
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        
        // Berry Hitboxes
        ctx.strokeStyle = '#ffd700';
        game.berries.forEach(b => {
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        // Crystal Hitboxes
        ctx.strokeStyle = '#00e436';
        game.crystals.forEach(c => {
            ctx.strokeRect(c.x, c.y, c.w, c.h);
        });

        // Collision Sensors (Visualizing the "Trunk" check)
        ctx.strokeStyle = 'yellow';
        ctx.strokeRect(p.x, p.y + 7, p.w, p.h - 14);

        ctx.restore();
        
        // Stats Overlay (Moved to Top Right to avoid HUD)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(VIEW_WIDTH - 160, 60, 150, 120);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        let ly = 80;
        const lx = VIEW_WIDTH - 150;
        ctx.fillText(`VX: ${p.vx.toFixed(2)}`, lx, ly); ly+=15;
        ctx.fillText(`VY: ${p.vy.toFixed(2)}`, lx, ly); ly+=15;
        ctx.fillText(`Grounded: ${p.grounded}`, lx, ly); ly+=15;
        ctx.fillText(`CanDash: ${p.canDash}`, lx, ly); ly+=15;
        ctx.fillText(`OnWall: ${p.onWall}`, lx, ly); ly+=15;
        ctx.fillText(`SpringTimer: ${p.springTimer.toFixed(2)}`, lx, ly); ly+=15;
        ctx.fillText(`FPS: ${Math.round(1000/16)}`, lx, ly);
    }

    draw(game: GameEngine) {
        const ctx = this.ctx;
        const p = game.player;

        // Clear
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Shake
        ctx.save();
        if (game.shake > 0) {
            const dx = (Math.random() - 0.5) * game.shake * 2;
            const dy = (Math.random() - 0.5) * game.shake * 2;
            ctx.translate(Math.floor(dx), Math.floor(dy));
        }

        // Parallax BG
        if (this.bgImg) {
            const bgY = Math.floor(game.cameraY * 0.5) % 960;
            ctx.drawImage(this.bgImg, 0, -bgY, VIEW_WIDTH, 960);
            ctx.drawImage(this.bgImg, 0, -bgY + 960, VIEW_WIDTH, 960);
            ctx.drawImage(this.bgImg, 0, -bgY - 960, VIEW_WIDTH, 960);
        }

        // --- BACKGROUND LAYER MILESTONES ---
        // Draw this BEFORE world entities so it's behind them
        if (game.milestone.active) {
             ctx.save();
             
             // Smooth fade logic
             let opacity = 1;
             let scale = 1;
             const t = game.milestone.timer;
             // @ts-ignore
             const maxT = game.milestone.maxTimer || 3.0; // Fallback if undefined

             if (t > maxT - 0.5) {
                 opacity = (maxT - t) / 0.5; // Fade in
                 scale = 0.8 + (1 - opacity) * 0.2; // Pop in
             } else if (t < 0.5) {
                 opacity = t / 0.5; // Fade out
             } else {
                 opacity = 1; // Hold
             }

             // Color Selection
             const isRecord = game.milestone.text.includes("RECORD");
             ctx.fillStyle = isRecord 
                ? `rgba(255, 215, 0, ${opacity * 0.6})` // Gold with opacity
                : `rgba(255, 255, 255, ${opacity * 0.15})`; // White with opacity

             // Modern Sans-Serif Font
             ctx.font = `900 ${Math.floor(64 * scale)}px sans-serif`; // Bold System Font
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             
             // Shadow for depth (especially for Gold)
             if (isRecord) {
                 ctx.shadowColor = 'rgba(0,0,0,0.5)';
                 ctx.shadowBlur = 10;
                 ctx.shadowOffsetY = 4;
             }

             // Draw in center of screen
             ctx.fillText(game.milestone.text, this.canvas.width / 2, this.canvas.height / 3);
             
             ctx.shadowColor = 'transparent';
             ctx.restore();
        }

        // Camera Transform
        ctx.translate(0, Math.floor(-game.cameraY));

        // Draw High Score Line
        if (game.highScore > 0) {
            const lineY = 150 - (game.highScore * TILE_SIZE);
            if (lineY > game.cameraY && lineY < game.cameraY + game.viewHeight) {
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(0, lineY);
                ctx.lineTo(VIEW_WIDTH, lineY);
                ctx.stroke();
                
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 16px monospace';
                ctx.fillText(`BEST ${game.highScore}M`, 10, lineY - 5);
                ctx.restore();
            }
        }

        // Draw Solids
        game.solids.forEach(s => {
            this.drawTiledRect(game, s.x, s.y, s.w, s.h);
        });

        // Draw Platforms
        game.platforms.forEach(pl => {
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
        game.springs.forEach(s => {
             if (this.springImg) {
                 ctx.save();
                 ctx.translate(s.x + 12, s.y + 12);
                 if (s.dir === 'left') ctx.rotate(-Math.PI/2);
                 if (s.dir === 'right') ctx.rotate(Math.PI/2);
                 const scale = 1 + (s.animTimer > 0 ? 0.4 : 0);
                 const off = s.animTimer > 0 ? -4 : 0;
                 ctx.drawImage(this.springImg, -12, -12 + off, 24, 24);
                 ctx.restore();
             }
        });

        // Crystals
        game.crystals.forEach(c => {
            if (c.respawnTimer > 0) {
                 // GHOST OUTLINE
                 ctx.save();
                 ctx.strokeStyle = COLORS.ghost;
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
            // Bobbing
            const bob = Math.sin(Date.now() / 500) * 2; 
            ctx.fillStyle = COLORS.crystal;
            
            // Draw resized crystal (22x22)
            if (this.crystalImg) {
                 ctx.drawImage(this.crystalImg, c.x, c.y + bob, 22, 22);
            }
            
            // Glow
            ctx.globalAlpha = 0.3;
            const cx = c.x + c.w/2;
            const cy = c.y + c.h/2 + bob;
            ctx.beginPath();
            ctx.arc(cx, cy, 12 + Math.sin(Date.now()/100)*2, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // Berries (Red)
        game.berries.forEach(b => {
             if (b.state === 2) return;
             if (this.berryImg) {
                 const bob = b.state === 0 ? Math.sin(Date.now()/250) * 3 : 0;
                 const size = 20; 
                 const offset = (30 - size) / 2;
                 ctx.drawImage(this.berryImg, b.x + offset, b.y + bob + offset, size, size);
             }
        });

        // Player Trail
        p.trail.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.alpha * 0.5;
            ctx.translate(Math.floor(t.x + 12), Math.floor(t.y + 12));
            ctx.scale(t.frame.sx * t.frame.faceDir, t.frame.sy);
            ctx.fillStyle = COLORS.hairDash;
            ctx.fillRect(-10, -8, 20, 20); 
            ctx.fillRect(-6, 0, 12, 12);  
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        // Player
        if (game.state !== GameState.GAMEOVER && game.state !== GameState.DYING) {
             this.drawPlayer(game, p);
        }

        // Particles
        game.particles.forEach(pt => {
             ctx.fillStyle = pt.color;
             ctx.fillRect(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.size), Math.floor(pt.size));
        });

        // Ripples
        ctx.lineWidth = 2;
        game.ripples.forEach(r => {
             ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
             ctx.beginPath();
             ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
             ctx.stroke();
        });

        // Death Ripple
        if (game.deathRipple.active) {
            ctx.fillStyle = game.deathRipple.color;
            ctx.beginPath();
            ctx.arc(game.deathRipple.x, game.deathRipple.y, game.deathRipple.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Snow (Foreground)
        ctx.fillStyle = 'white';
        game.snow.forEach(s => {
             ctx.globalAlpha = 0.6;
             ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.floor(s.size), Math.floor(s.size));
        });
        ctx.globalAlpha = 1;

        ctx.restore(); // Pop Camera 

        // Draw Abyss Gradient
        if (game.state === GameState.PLAYING) {
             const grad = ctx.createLinearGradient(0, game.viewHeight - 150, 0, game.viewHeight);
             grad.addColorStop(0, "rgba(0,0,0,0)");
             grad.addColorStop(1, "rgba(0,0,0,1)");
             ctx.fillStyle = grad;
             ctx.fillRect(0, game.viewHeight - 150, this.canvas.width, 150);
        }

        // DRAW DEBUG OVERLAY if enabled
        if (game.debug) {
            this.drawDebug(game);
        }

        ctx.restore(); // Pop Shake
    }
}
