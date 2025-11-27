import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState } from './types';
import { sfx } from './services/audioService';

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // React State for UI
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [hudHeight, setHudHeight] = useState(0);
  const [hudBerries, setHudBerries] = useState(0);
  const [hudTimer, setHudTimer] = useState("00:00.00");
  const [pendingBerries, setPendingBerries] = useState(0);
  const [berryPop, setBerryPop] = useState(false);
  const [scorePop, setScorePop] = useState(false);
  
  const [isRecordRun, setIsRecordRun] = useState(false);
  const [milestone, setMilestone] = useState<{ text: string, active: boolean, isRecord: boolean }>({ text: '', active: false, isRecord: false });
  const [gameOverStats, setGameOverStats] = useState({ height: 0, berries: 0, rank: 'C', time: "00:00", speed: "0" });
  
  const [homeTransition, setHomeTransition] = useState(false);
  const [retryTransition, setRetryTransition] = useState(false);
  const [startTransition, setStartTransition] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Input Highlighting
  const [activeAction, setActiveAction] = useState<{jump: boolean, dash: boolean, left: boolean, right: boolean}>({ jump: false, dash: false, left: false, right: false });

  const [highScore, setHighScore] = useState(0);

  // Use a Ref to track gameState for event listeners to avoid stale closures and re-binding issues
  const gameStateRef = useRef(GameState.TITLE);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Callbacks Ref to hold fresh instances of handlers without re-triggering effects
  const callbacksRef = useRef({
    onScoreUpdate: (h: number, b: number, isRecord: boolean, time: number, pb: number) => {},
    onGameOver: (h: number, b: number, newRecord: boolean, time: number) => {},
    onMilestone: (text: string, isRecord: boolean) => {}
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

  const handleScoreUpdate = useCallback((h: number, b: number, isRecord: boolean, time: number, pb: number) => {
    setHudHeight(h);
    if (b > hudBerries) {
        setScorePop(true);
        setTimeout(() => setScorePop(false), 150);
    }
    setHudBerries(b);
    setIsRecordRun(isRecord);
    
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
    let rank = "C";
    const score = h + b * 50;
    if (score > 1000) rank = "B";
    if (score > 3000) rank = "A";
    if (score > 5000) rank = "S";
    if (score > 10000) rank = "🍓";
    
    const sec = time / 1000;
    const speed = sec > 0 ? (h / sec).toFixed(1) : "0";
    
    if (newRecord) {
        localStorage.setItem('dc_highscore', h.toString());
        setHighScore(h);
    }

    setGameOverStats({ height: h, berries: b, rank, time: formatTime(time), speed });
    setGameState(GameState.GAMEOVER);
  }, []);

  const handleMilestone = useCallback((text: string, isRecord: boolean) => {
    setMilestone({ text, active: true, isRecord });
    if (isRecord) sfx.play('record');
    setTimeout(() => {
        setMilestone(prev => ({ ...prev, active: false }));
    }, 2500);
  }, []);

  // Update callbacks ref
  useEffect(() => {
    callbacksRef.current.onScoreUpdate = handleScoreUpdate;
    callbacksRef.current.onGameOver = handleGameOver;
    callbacksRef.current.onMilestone = handleMilestone;
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
    
    // FPS Management:
    // We want to cap at ~60FPS, but not aggressively skip frames on 60Hz screens.
    // 12ms threshold allows 144Hz screens (approx 7ms frame time) to skip every other frame,
    // while 60Hz screens (approx 16.6ms) will pass the check every frame.
    const delta = time - lastFrameTimeRef.current;
    if (delta < 12) return; 
    
    lastFrameTimeRef.current = time;

    // Convert to seconds, cap at 0.06 (approx 15fps) to prevent physics explosions
    let dt = delta / 1000;
    if (dt > 0.06) dt = 0.06;
      
    if (engineRef.current) {
      engineRef.current.update(dt, {
        dir: inputRef.current.dir,
        jump: inputRef.current.jump,
        dash: inputRef.current.dash,
        jumpHeld: inputRef.current.jumpHeld
      });
      engineRef.current.draw();
      
      // Reset one-shot inputs
      if (inputRef.current.jump) inputRef.current.jump = false;
      if (inputRef.current.dash) inputRef.current.dash = false;
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
            engineRef.current.initGame();
            setGameState(GameState.PLAYING);
            setHudTimer("00:00.00");
          }
          setRetryTransition(false);
      }, 250); // 250ms fast transition
  };

  // Direct start with transition
  const startGame = () => {
    setStartTransition(true);
    setTimeout(() => {
        sfx.init();
        if (engineRef.current) {
          engineRef.current.initGame();
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
        setIsRecordRun(false);
        setTimeout(() => setHomeTransition(false), 100);
    }, 500);
  };

  // One-time Engine Initialization
  useEffect(() => {
    const saved = localStorage.getItem('dc_highscore');
    if (saved) setHighScore(parseInt(saved));

    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(
          canvasRef.current,
          (h, b, r, t, pb) => callbacksRef.current.onScoreUpdate(h, b, r, t, pb),
          (h, b, r, t) => callbacksRef.current.onGameOver(h, b, r, t),
          (t, r) => callbacksRef.current.onMilestone(t, r)
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
    e.preventDefault(); // Prevent default browser behavior (selection/menu)
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

        {/* Slow Home Transition Overlay */}
        <div className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-500 ease-in-out ${homeTransition ? 'opacity-100' : 'opacity-0'}`} />
        
        {/* Fast Retry Transition Overlay */}
        <div className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-200 ease-out ${retryTransition ? 'opacity-100' : 'opacity-0'}`} />

        {/* Start Game Transition Overlay */}
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
                   
                   {/* Pause Button (Visible only when playing) */}
                   {gameState === GameState.PLAYING && (
                       <button 
                           onClick={togglePause}
                           className="pointer-events-auto bg-black/40 hover:bg-black/60 text-white/70 hover:text-white p-2 rounded-lg backdrop-blur-sm transition-all"
                       >
                           <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                       </button>
                   )}
               </div>
           </div>
        </div>

        {/* Milestone Pop-up */}
        <div 
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black pointer-events-none transition-all duration-500 z-20 whitespace-nowrap ${
            milestone.active ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          } ${milestone.isRecord ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]' : 'text-white/30'}`}
        >
          {milestone.text}
        </div>

        {/* Title Screen */}
        {gameState === GameState.TITLE && (
          <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-8 z-30 transition-opacity">
            <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 drop-shadow-md">
              Reach for the <span className="text-sky-400">Summit</span>
            </h1>
            <div className="text-yellow-400 font-bold text-xl mb-8">BEST: {highScore}M</div>
            <div className="text-gray-400 text-center text-sm mb-8 space-y-2">
              <p>[Arrows] Move</p>
              <p>[K/Z] Jump • [X/J] Dash</p>
              <p className="text-xs opacity-70 mt-4">Dash Up + Jump at Wall = Super Boost!</p>
            </div>
            <button 
              onClick={startGame}
              className="w-full max-w-xs py-4 bg-sky-500 hover:bg-sky-400 active:translate-y-1 border-b-4 border-sky-700 rounded-xl text-xl font-bold transition-all shadow-lg"
            >
              🏔 CLIMB
            </button>
            <div className="absolute bottom-4 right-4 text-xs text-white/20">Ver 0.9_48_polish_4</div>
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

        {/* Game Over Screen */}
        {gameState === GameState.GAMEOVER && (
          <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-8 z-30 animate-fade-in-up">
            <div className="w-full max-w-xs bg-gray-800 border-4 border-white rounded-2xl p-6 shadow-2xl mb-6">
              <h2 className="text-4xl font-bold text-red-500 text-center mb-6 drop-shadow-sm">GAME OVER</h2>
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-400">
                  <div className="border-b border-dashed border-gray-600 pb-1">Height</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.height}M</div>
                  
                  <div className="border-b border-dashed border-gray-600 pb-1">Time</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.time}</div>
                  
                  <div className="border-b border-dashed border-gray-600 pb-1">Speed</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.speed} m/s</div>

                  <div className="border-b border-dashed border-gray-600 pb-1">Berries</div>
                  <div className="border-b border-dashed border-gray-600 pb-1 text-right text-white font-bold">{gameOverStats.berries}</div>
              </div>
              
              <div className="flex justify-between items-center text-gray-400 text-lg">
                <span>Rank</span>
                <span className="text-yellow-400 font-black text-4xl">{gameOverStats.rank}</span>
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
        {gameState === GameState.PLAYING && (
        <div 
          className="absolute inset-0 pointer-events-none z-40 lg:hidden flex flex-col justify-end pb-16 px-4"
          onContextMenu={(e) => e.preventDefault()} 
        >
            <div className="flex justify-between w-full items-end">
              {/* D-Pad Area */}
              <div className="flex gap-4 pointer-events-auto select-none" style={{ WebkitTouchCallout: 'none' }}>
                 <div 
                   className={`w-24 h-28 bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center transition-colors ${activeAction.left ? 'bg-white/40 border-white' : ''}`}
                   onTouchStart={handleTouchStart('left')} onTouchEnd={handleTouchEnd('left')}
                 >
                   <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                 </div>
                 <div 
                   className={`w-24 h-28 bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center transition-colors ${activeAction.right ? 'bg-white/40 border-white' : ''}`}
                   onTouchStart={handleTouchStart('right')} onTouchEnd={handleTouchEnd('right')}
                 >
                   <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                 </div>
              </div>

              {/* Action Buttons with Visual Feedback */}
              <div className="flex flex-col gap-4 pointer-events-auto select-none" style={{ WebkitTouchCallout: 'none' }}>
                 <div 
                   className={`w-24 h-24 bg-red-500/40 border-2 border-white/30 rounded-full flex items-center justify-center transition-colors transform duration-75 ${activeAction.jump ? 'scale-95 bg-white/50' : ''}`}
                   onTouchStart={handleTouchStart('jump')} onTouchEnd={handleTouchEnd('jump')}
                 >
                    <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>
                 </div>
                 <div 
                   className={`w-24 h-24 bg-sky-500/40 border-2 border-white/30 rounded-full flex items-center justify-center transition-colors transform duration-75 ${activeAction.dash ? 'scale-95 bg-white/50' : ''}`}
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