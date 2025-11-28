import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState, GameMode } from './types';
import { sfx } from './services/audioService';

// --- LOGO COMPONENT ---
const GameLogo = () => (
  <div className="relative w-full max-w-md mb-6 flex justify-center animate-fade-in-up">
      <svg viewBox="0 0 320 160" className="w-full overflow-visible drop-shadow-2xl">
        <defs>
            <linearGradient id="textGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#bae6fd" />
                <stop offset="45%" stopColor="#38bdf8" />
                <stop offset="95%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="mtnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="4" dy="4" stdDeviation="0" floodColor="#0c4a6e"/>
            </filter>
        </defs>
        
        {/* Background Mountain */}
        <g transform="translate(160, 90)">
            <path d="M0 -80 L70 60 H-70 Z" fill="url(#mtnGrad)" stroke="#1e1b4b" strokeWidth="3" />
            <path d="M0 -80 L20 60 H-20 Z" fill="rgba(0,0,0,0.2)" />
            {/* Snow Cap */}
            <path d="M0 -80 L15 -55 L5 -60 L0 -50 L-5 -60 L-15 -55 Z" fill="white" />
        </g>

        {/* Small Top Text */}
        <text x="160" y="82" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="16" fill="#e0f2fe" letterSpacing="1" style={{textShadow: '2px 2px 0px #1e3a8a'}} transform="rotate(-2, 160, 80)">
            REACH FOR THE
        </text>

        {/* Main SUMMIT Text */}
        <g transform="translate(0, 15) rotate(-3, 160, 110)">
            {/* 3D Extrusion Layer */}
            <text x="160" y="130" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="68" fill="#0c4a6e" letterSpacing="-2" stroke="#0c4a6e" strokeWidth="8">
                SUMMIT
            </text>
            {/* Main Face Layer */}
            <text x="160" y="125" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="68" fill="url(#textGrad)" stroke="white" strokeWidth="2.5" letterSpacing="-2">
                SUMMIT
            </text>
            
            {/* Snow patches on text */}
            <path d="M55 92 Q65 88 75 92 Q70 98 65 96 Z" fill="white" transform="translate(20,0)"/>
            <path d="M190 92 Q200 88 210 92 Q205 98 200 96 Z" fill="white" transform="translate(-10,0)"/>
        </g>

        {/* The Red Flag (Emphasizing Summit) */}
        <g transform="translate(255, 65) rotate(5)">
            <rect x="0" y="0" width="3" height="60" fill="#44403c" />
            <path d="M3 2 L45 15 L3 28 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
            {/* Skull Detail */}
            <circle cx="15" cy="15" r="4" fill="rgba(255,255,255,0.3)" />
        </g>
      </svg>
  </div>
);

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0); // New accumulator for fixed timestep

  // React State for UI
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [hudHeight, setHudHeight] = useState(0);
  const [hudBerries, setHudBerries] = useState(0);
  const [hudTimer, setHudTimer] = useState("00:00.00");
  const [currentSpeed, setCurrentSpeed] = useState("0.00"); 
  const [pendingBerries, setPendingBerries] = useState(0);
  const [berryPop, setBerryPop] = useState(false);
  const [scorePop, setScorePop] = useState(false);
  
  const [isRecordRun, setIsRecordRun] = useState(false);
  const [gameOverStats, setGameOverStats] = useState({ height: 0, berries: 0, time: "00:00", speed: "0" });
  
  const [homeTransition, setHomeTransition] = useState(false);
  const [retryTransition, setRetryTransition] = useState(false);
  const [startTransition, setStartTransition] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Countdown UI State
  const [countdown, setCountdown] = useState(0);

  // Input Highlighting
  const [activeAction, setActiveAction] = useState<{jump: boolean, dash: boolean, left: boolean, right: boolean}>({ jump: false, dash: false, left: false, right: false });

  const [highScore, setHighScore] = useState(0);
  const [bestTime, setBestTime] = useState(0);
  const [currentGameMode, setCurrentGameMode] = useState<GameMode>(GameMode.ENDLESS);

  // Use a Ref to track gameState for event listeners to avoid stale closures and re-binding issues
  const gameStateRef = useRef(GameState.TITLE);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Callbacks Ref to hold fresh instances of handlers without re-triggering effects
  const callbacksRef = useRef({
    onScoreUpdate: (h: number, b: number, isRecord: boolean, time: number, pb: number, speed: string) => {},
    onGameOver: (h: number, b: number, newRecord: boolean, time: number) => {},
    onLevelComplete: (time: number, newRecord: boolean) => {}
  });

  const inputRef = useRef({
    dir: 0,
    jump: false,
    dash: false,
    jumpHeld: false,
    dashHeld: false
  });

  const formatTime = (ms: number) => {
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
      return `${m}:${s}.${cs}`;
  };

  const handleScoreUpdate = useCallback((h: number, b: number, isRecord: boolean, time: number, pb: number, speed: string) => {
    setHudHeight(h);
    if (b > hudBerries) {
        setScorePop(true);
        setTimeout(() => setScorePop(false), 150);
    }
    setHudBerries(b);
    setIsRecordRun(isRecord);
    setCurrentSpeed(speed); 
    
    if (gameStateRef.current === GameState.PLAYING) {
      setHudTimer(formatTime(time));
    }
    
    if (pb > pendingBerries) {
         setBerryPop(true);
         setTimeout(() => setBerryPop(false), 100);
    }
    setPendingBerries(pb);
  }, [hudBerries, pendingBerries]);

  const handleGameOver = useCallback((h: number, b: number, newRecord: boolean, time: number) => {
    const sec = time / 1000;
    const speed = sec > 0 ? (h / sec).toFixed(2) : "0.00";
    
    if (newRecord && currentGameMode === GameMode.ENDLESS) {
        localStorage.setItem('dc_highscore', h.toString());
        setHighScore(h);
    }

    setGameOverStats({ height: h, berries: b, time: formatTime(time), speed });
    setGameState(GameState.GAMEOVER);
  }, [currentGameMode]);

  const handleLevelComplete = useCallback((time: number, newRecord: boolean) => {
      const sec = time / 1000;
      const speed = sec > 0 ? (1000 / sec).toFixed(2) : "0.00";
      
      if (newRecord && currentGameMode === GameMode.TIME_ATTACK) {
          localStorage.setItem('dc_besttime', time.toString());
          setBestTime(time);
      }

      setGameOverStats({ height: 1000, berries: hudBerries, time: formatTime(time), speed });
      setIsRecordRun(newRecord); // Reuse for showing "New Record" text
      setGameState(GameState.COMPLETE);
  }, [hudBerries, currentGameMode]);

  // Update callbacks ref
  useEffect(() => {
    callbacksRef.current.onScoreUpdate = handleScoreUpdate;
    callbacksRef.current.onGameOver = handleGameOver;
    callbacksRef.current.onLevelComplete = handleLevelComplete;
  });

  // Toggle Debug Mode
  const toggleDebug = () => {
      setDebugMode(prev => {
          const next = !prev;
          if (engineRef.current) engineRef.current.debug = next;
          return next;
      });
  };

  const animate = (time: number) => {
    requestRef.current = requestAnimationFrame(animate);
    
    // --- 60FPS LOCKED TIMESTEP LOOP ---
    const delta = time - lastFrameTimeRef.current;
    lastFrameTimeRef.current = time;

    // Cap delta to avoid "spiral of death" if tab is backgrounded
    let frameTime = delta / 1000;
    if (frameTime > 0.25) frameTime = 0.25;

    accumulatorRef.current += frameTime;
    const FIXED_STEP = 1 / 60; // Locked 60FPS physics step

    if (engineRef.current) {
        // Only run update if we have enough accumulated time
        while (accumulatorRef.current >= FIXED_STEP) {
             engineRef.current.update(FIXED_STEP, {
                dir: inputRef.current.dir,
                jump: inputRef.current.jump,
                dash: inputRef.current.dash,
                jumpHeld: inputRef.current.jumpHeld
              });
              
              // Reset one-shot inputs AFTER the update consumes them
              if (inputRef.current.jump) inputRef.current.jump = false;
              if (inputRef.current.dash) inputRef.current.dash = false;

              accumulatorRef.current -= FIXED_STEP;
        }

        // Draw every frame (interpolation could go here, but omitted for pixel style)
        engineRef.current.draw();
        
        // Update React State for UI (Countdown)
        if (engineRef.current.gameMode === GameMode.TIME_ATTACK) {
             setCountdown(Math.ceil(engineRef.current.countdown));
        } else {
             setCountdown(0);
        }
    }
  };

  const togglePause = useCallback(() => {
    if (!engineRef.current) return;
    
    // Use ref to get current state immediately
    const current = gameStateRef.current;
    
    if (current === GameState.PLAYING) {
        setGameState(GameState.PAUSED);
        engineRef.current.state = GameState.PAUSED;
    } else if (current === GameState.PAUSED) {
        setGameState(GameState.PLAYING);
        engineRef.current.state = GameState.PLAYING;
    }
  }, []);

  const resumeGame = () => {
      if (engineRef.current) engineRef.current.state = GameState.PLAYING;
      setGameState(GameState.PLAYING);
  };

  // Fast transition for Retry
  const handleRetry = () => {
      setRetryTransition(true);
      setTimeout(() => {
          sfx.init();
          if (engineRef.current) {
            engineRef.current.initGame(currentGameMode);
            setGameState(GameState.PLAYING);
            setHudTimer("00:00.00");
          }
          setRetryTransition(false);
      }, 250); 
  };

  // Direct start with transition
  const startGame = (mode: GameMode) => {
    setCurrentGameMode(mode);
    setStartTransition(true);
    setTimeout(() => {
        sfx.init();
        if (engineRef.current) {
          engineRef.current.initGame(mode);
          setGameState(GameState.PLAYING);
          setHudTimer("00:00.00");
        }
        setStartTransition(false);
    }, 500);
  };

  // Slow transition for Home
  const toTitle = () => {
    setHomeTransition(true);
    setTimeout(() => {
        sfx.init();
        if (engineRef.current) {
            engineRef.current.state = GameState.TITLE;
            engineRef.current.deathRipple.active = false; 
        }
        setGameState(GameState.TITLE);
        const saved = localStorage.getItem('dc_highscore');
        if (saved) setHighScore(parseInt(saved));
        const savedTime = localStorage.getItem('dc_besttime');
        if (savedTime) setBestTime(parseInt(savedTime));

        setIsRecordRun(false);
        setTimeout(() => setHomeTransition(false), 100);
    }, 500);
  };

  // One-time Engine Initialization
  useEffect(() => {
    const saved = localStorage.getItem('dc_highscore');
    if (saved) setHighScore(parseInt(saved));
    const savedTime = localStorage.getItem('dc_besttime');
    if (savedTime) setBestTime(parseInt(savedTime));

    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(
          canvasRef.current,
          (h, b, r, t, pb, s) => callbacksRef.current.onScoreUpdate(h, b, r, t, pb, s),
          (h, b, r, t) => callbacksRef.current.onGameOver(h, b, r, t),
          (t, nr) => callbacksRef.current.onLevelComplete(t, nr)
      );
      lastFrameTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Event Listeners (using refs for stable access)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
          togglePause();
          return;
      }
      
      if (engineRef.current?.state === GameState.PAUSED) return;

      if (['a', 'arrowleft'].includes(k)) {
          inputRef.current.dir = -1;
          setActiveAction(prev => ({...prev, left: true}));
      }
      if (['d', 'arrowright'].includes(k)) {
          inputRef.current.dir = 1;
          setActiveAction(prev => ({...prev, right: true}));
      }
      if ([' ', 'k', 'z'].includes(k)) {
        if (!inputRef.current.jumpHeld) {
           inputRef.current.jump = true;
           inputRef.current.jumpHeld = true;
        }
        setActiveAction(prev => ({...prev, jump: true}));
      }
      if (['shift', 'x', 'j'].includes(k)) {
        if (!inputRef.current.dashHeld) {
           inputRef.current.dash = true;
           inputRef.current.dashHeld = true;
        }
        setActiveAction(prev => ({...prev, dash: true}));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      
      if (['a', 'arrowleft'].includes(k)) {
          if (inputRef.current.dir === -1) inputRef.current.dir = 0;
          setActiveAction(prev => ({...prev, left: false}));
      }
      if (['d', 'arrowright'].includes(k)) {
          if (inputRef.current.dir === 1) inputRef.current.dir = 0;
          setActiveAction(prev => ({...prev, right: false}));
      }
      if ([' ', 'k', 'z'].includes(k)) {
          inputRef.current.jumpHeld = false;
          setActiveAction(prev => ({...prev, jump: false}));
      }
      if (['shift', 'x', 'j'].includes(k)) {
          inputRef.current.dashHeld = false;
          setActiveAction(prev => ({...prev, dash: false}));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', () => engineRef.current?.resize());
    // Prevent context menu globally for better mobile experience
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', (e) => e.preventDefault());
    };
  }, [togglePause]);

  const handleTouchStart = (action: 'left' | 'right' | 'jump' | 'dash') => (e: React.TouchEvent) => {
    e.preventDefault(); 
    if (gameStateRef.current === GameState.PAUSED) return;
    if (action === 'left') { inputRef.current.dir = -1; setActiveAction(prev => ({...prev, left: true})); }
    if (action === 'right') { inputRef.current.dir = 1; setActiveAction(prev => ({...prev, right: true})); }
    if (action === 'jump') { 
        inputRef.current.jump = true; inputRef.current.jumpHeld = true; 
        setActiveAction(prev => ({...prev, jump: true}));
    }
    if (action === 'dash') { 
        inputRef.current.dash = true; inputRef.current.dashHeld = true; 
        setActiveAction(prev => ({...prev, dash: true}));
    }
  };

  const handleTouchEnd = (action: 'left' | 'right' | 'jump' | 'dash') => (e: React.TouchEvent) => {
    e.preventDefault();
    if (action === 'left') { 
        if(inputRef.current.dir === -1) inputRef.current.dir = 0; 
        setActiveAction(prev => ({...prev, left: false})); 
    }
    if (action === 'right') { 
        if(inputRef.current.dir === 1) inputRef.current.dir = 0; 
        setActiveAction(prev => ({...prev, right: false})); 
    }
    if (action === 'jump') { 
        inputRef.current.jumpHeld = false; 
        setActiveAction(prev => ({...prev, jump: false}));
    }
    if (action === 'dash') { 
        inputRef.current.dashHeld = false; 
        setActiveAction(prev => ({...prev, dash: false}));
    }
  };

  return (
    <div 
      className="relative w-full h-[100dvh] bg-gray-900 flex justify-center overflow-hidden font-mono text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full h-full max-w-[540px] shadow-2xl">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Transitions */}
        <div className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-500 ease-in-out ${homeTransition ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-200 ease-out ${retryTransition ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-500 ease-in-out ${startTransition ? 'opacity-100' : 'opacity-0'}`} />

        {/* HUD */}
        <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10 flex flex-col gap-2">
           <div className="flex justify-between items-start">
               <div>
                   {/* Timer */}
                   <div className={`font-mono text-2xl font-bold drop-shadow-md ${gameState === GameState.GAMEOVER ? 'text-gray-500' : 'text-gray-300'}`}>{hudTimer}</div>
                   
                   <div className="flex items-center gap-2 mt-1">
                      <div className={`bg-black/50 border-2 rounded-full px-4 py-1 flex items-center gap-2 transition-colors duration-300 ${
                          isRecordRun ? 'border-yellow-400 text-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'border-white/20 text-white'
                      }`}>
                         <span>▲</span> <span>{hudHeight}M</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 relative mt-1">
                      <div className={`bg-black/50 border-2 border-white/20 rounded-full px-4 py-1 flex items-center gap-2 transition-all duration-150 ${
                          scorePop ? 'scale-125 bg-red-500/20 border-red-400' : ''
                      }`}>
                         <span>🍓</span> <span className="text-white">{hudBerries}</span>
                      </div>
                      {pendingBerries > 0 && (
                          <div className={`absolute -top-2 left-16 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full transition-transform ${
                              berryPop ? 'scale-150' : 'scale-100'
                          }`}>
                              +{pendingBerries}
                          </div>
                      )}
                   </div>
               </div>
               
               <div className="flex flex-col items-end gap-2">
                   <div className="flex gap-2">
                       {/* Debug Button */}
                       {gameState === GameState.PLAYING && (
                           <button 
                               onClick={toggleDebug}
                               className={`pointer-events-auto p-2 rounded-lg backdrop-blur-sm transition-all ${debugMode ? 'bg-green-600/60 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'}`}
                           >
                               🐞
                           </button>
                       )}
                       
                       {/* Pause Button */}
                       {gameState === GameState.PLAYING && (
                           <button 
                               onClick={togglePause}
                               className="pointer-events-auto bg-black/40 hover:bg-black/60 text-white/70 hover:text-white p-2 rounded-lg backdrop-blur-sm transition-all"
                           >
                               <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                           </button>
                       )}
                   </div>

                   {/* Speedometer */}
                   {gameState === GameState.PLAYING && (
                        <div className="bg-black/50 border-2 border-white/20 rounded-lg px-2 py-1 text-xs text-gray-300 text-right backdrop-blur-sm">
                            <span className="text-white font-bold">{currentSpeed}</span> <span className="text-[10px] text-gray-400">m/s</span>
                        </div>
                   )}
               </div>
           </div>
        </div>

        {/* TIME ATTACK COUNTDOWN OVERLAY */}
        {countdown > 0 && gameState === GameState.PLAYING && (
             <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30 pointer-events-none">
                 <div 
                   key={countdown} 
                   className={`text-9xl font-black drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-bounce transition-colors duration-500
                   ${countdown === 3 ? 'text-red-500' : countdown === 2 ? 'text-orange-400' : 'text-yellow-300'}`}
                 >
                     {countdown}
                 </div>
             </div>
        )}

        {/* Title Screen */}
        {gameState === GameState.TITLE && (
          <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-8 z-30 transition-opacity">
            
            <GameLogo />
            
            <div className="w-full max-w-xs space-y-4">
                 <button 
                  onClick={() => startGame(GameMode.ENDLESS)}
                  className="w-full py-4 bg-sky-500 hover:bg-sky-400 active:translate-y-1 border-b-4 border-sky-700 rounded-xl text-xl font-bold transition-all shadow-lg flex flex-col items-center leading-none justify-center gap-1"
                >
                  <span>🏔 CLIMB</span>
                  {highScore > 0 && <span className="text-xs font-bold text-sky-900 opacity-80">BEST: {highScore}M</span>}
                </button>
                <button 
                  onClick={() => startGame(GameMode.TIME_ATTACK)}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-400 active:translate-y-1 border-b-4 border-orange-700 rounded-xl text-xl font-bold transition-all shadow-lg flex flex-col items-center leading-none gap-1"
                >
                  <span>⏱ TIME ATTACK</span>
                  <span className="text-xs opacity-70 font-normal">Race to 1000M</span>
                  {bestTime > 0 && <span className="text-xs font-bold text-orange-900 opacity-80">BEST: {formatTime(bestTime)}</span>}
                </button>
            </div>

            <div className="text-gray-400 text-center text-sm mt-8 space-y-2">
              <p>[Arrows] Move</p>
              <p>[K/Z] Jump • [X/J] Dash</p>
            </div>
            <div className="absolute bottom-4 right-4 text-xs text-white/20">v1.0_0</div>
          </div>
        )}

        {/* Pause Menu */}
        {gameState === GameState.PAUSED && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-50 animate-fade-in-up">
             <h2 className="text-4xl font-bold text-white mb-8 tracking-widest">PAUSED</h2>
             <div className="flex flex-col gap-4 w-full max-w-xs">
                 <button 
                    onClick={resumeGame}
                    className="w-full py-4 bg-sky-600 hover:bg-sky-500 active:translate-y-1 border-b-4 border-sky-800 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                 >
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    RESUME
                 </button>
                 <button 
                    onClick={handleRetry}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 active:translate-y-1 border-b-4 border-red-800 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                 >
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                    RETRY
                 </button>
                 <button 
                    onClick={toTitle}
                    className="w-full py-4 bg-gray-700 hover:bg-gray-600 active:translate-y-1 border-b-4 border-gray-900 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                 >
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                    HOME
                 </button>
             </div>
          </div>
        )}

        {/* Result Screen (Game Over OR Complete) */}
        {(gameState === GameState.GAMEOVER || gameState === GameState.COMPLETE) && (
          <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-8 z-30 animate-fade-in-up">
            <div className={`w-full max-w-xs border-4 rounded-2xl p-6 shadow-2xl mb-6 ${gameState === GameState.COMPLETE ? 'bg-orange-900/40 border-orange-400' : 'bg-gray-800 border-white'}`}>
              <h2 className={`text-4xl font-bold text-center mb-6 drop-shadow-sm ${gameState === GameState.COMPLETE ? 'text-orange-400' : 'text-red-500'}`}>
                  {gameState === GameState.COMPLETE ? 'COMPLETE!!' : 'GAME OVER'}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-400">
                  <div className="border-b border-dashed border-gray-600 pb-1">Time</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.time}</div>
                  
                  <div className="border-b border-dashed border-gray-600 pb-1">Speed</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.speed} m/s</div>

                  <div className="border-b border-dashed border-gray-600 pb-1">Berries</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.berries}</div>
              </div>
              
              {isRecordRun && (
                  <div className="mb-4 text-center animate-pulse">
                      <span className="bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm">NEW RECORD!</span>
                  </div>
              )}

              {/* Highlighted Stat */}
              <div className="bg-black/40 rounded-xl p-4 text-center border-2 border-white/10">
                <div className="text-gray-500 text-xs tracking-widest uppercase mb-1">
                    {currentGameMode === GameMode.TIME_ATTACK && gameState === GameState.COMPLETE ? 'Final Time' : 'Final Height'}
                </div>
                <div className="text-yellow-400 font-black text-5xl drop-shadow-[0_2px_10px_rgba(255,215,0,0.3)]">
                    {currentGameMode === GameMode.TIME_ATTACK && gameState === GameState.COMPLETE ? gameOverStats.time : `${gameOverStats.height}M`}
                </div>
              </div>
            </div>

            <div className="flex gap-4 w-full max-w-xs">
              <button 
                onClick={toTitle}
                className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 active:translate-y-1 border-b-4 border-gray-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                HOME
              </button>
              <button 
                onClick={handleRetry}
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 active:translate-y-1 border-b-4 border-red-800 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                RETRY
              </button>
            </div>
          </div>
        )}

        {/* Mobile Controls Overlay */}
        {(gameState === GameState.PLAYING) && (
        <div 
          className="absolute inset-0 pointer-events-none z-40 lg:hidden flex flex-col justify-end pb-16 px-4"
          onContextMenu={(e) => e.preventDefault()} 
        >
            <div className="flex justify-between w-full items-end">
              {/* D-Pad Area */}
              <div className="flex gap-4 pointer-events-auto select-none" style={{ WebkitTouchCallout: 'none' }}>
                 <div 
                   className={`w-[88px] h-[105px] bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center transition-colors ${activeAction.left ? 'bg-white/40 border-white' : ''}`}
                   onTouchStart={handleTouchStart('left')} onTouchEnd={handleTouchEnd('left')}
                 >
                   <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                 </div>
                 <div 
                   className={`w-[88px] h-[105px] bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center transition-colors ${activeAction.right ? 'bg-white/40 border-white' : ''}`}
                   onTouchStart={handleTouchStart('right')} onTouchEnd={handleTouchEnd('right')}
                 >
                   <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                 </div>
              </div>

              {/* Action Buttons with Visual Feedback */}
              <div className="flex flex-col gap-4 pointer-events-auto select-none" style={{ WebkitTouchCallout: 'none' }}>
                 <div 
                   className={`w-[88px] h-[88px] bg-red-500/40 border-2 border-white/30 rounded-full flex items-center justify-center transition-colors transform duration-75 ${activeAction.jump ? 'scale-95 bg-white/50' : ''}`}
                   onTouchStart={handleTouchStart('jump')} onTouchEnd={handleTouchEnd('jump')}
                 >
                    <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>
                 </div>
                 <div 
                   className={`w-[88px] h-[88px] bg-sky-500/40 border-2 border-white/30 rounded-full flex items-center justify-center transition-colors transform duration-75 ${activeAction.dash ? 'scale-95 bg-white/50' : ''}`}
                   onTouchStart={handleTouchStart('dash')} onTouchEnd={handleTouchEnd('dash')}
                 >
                    <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path transform="translate(0, 3)" d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41M7.41,9.41L12,4.83L16.59,9.41L18,8L12,2L6,8L7.41,9.41Z"/></svg>
                 </div>
              </div>
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default App;