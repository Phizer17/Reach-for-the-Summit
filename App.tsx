
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState } from './types';
import { sfx } from './services/audioService';

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  // React State for UI
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [hudHeight, setHudHeight] = useState(0);
  const [hudBerries, setHudBerries] = useState(0);
  const [isRecordRun, setIsRecordRun] = useState(false);
  const [milestone, setMilestone] = useState<{ text: string, active: boolean, isRecord: boolean }>({ text: '', active: false, isRecord: false });
  const [gameOverStats, setGameOverStats] = useState({ height: 0, berries: 0, rank: 'C' });
  
  // High score for title screen
  const [highScore, setHighScore] = useState(0);

  // Input State
  const inputRef = useRef({
    dir: 0,
    jump: false,
    dash: false,
    jumpHeld: false,
    dashHeld: false
  });

  const handleScoreUpdate = useCallback((h: number, b: number, isRecord: boolean) => {
    setHudHeight(h);
    setHudBerries(b);
    setIsRecordRun(isRecord);
  }, []);

  const handleGameOver = useCallback((h: number, b: number, newRecord: boolean) => {
    let rank = "C";
    const score = h + b * 50;
    if (score > 1000) rank = "B";
    if (score > 3000) rank = "A";
    if (score > 5000) rank = "S";
    if (score > 10000) rank = "🍓";
    
    setGameOverStats({ height: h, berries: b, rank });
    setGameState(GameState.GAMEOVER);
  }, []);

  const handleMilestone = useCallback((text: string, isRecord: boolean) => {
    setMilestone({ text, active: true, isRecord });
    if (isRecord) sfx.play('record');
    setTimeout(() => {
        setMilestone(prev => ({ ...prev, active: false }));
    }, 2500);
  }, []);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      let dt = (time - previousTimeRef.current) / 1000;
      if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes
      
      if (engineRef.current) {
        // Feed input to engine
        engineRef.current.update(dt, {
          dir: inputRef.current.dir,
          jump: inputRef.current.jump,
          dash: inputRef.current.dash
        });
        engineRef.current.draw();
        
        // Consume press-once inputs
        if (inputRef.current.jump) inputRef.current.jump = false;
        if (inputRef.current.dash) inputRef.current.dash = false;
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const saved = localStorage.getItem('dc_highscore');
    if (saved) setHighScore(parseInt(saved));

    if (canvasRef.current) {
      engineRef.current = new GameEngine(
          canvasRef.current,
          handleScoreUpdate,
          handleGameOver,
          handleMilestone
      );
      requestRef.current = requestAnimationFrame(animate);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['a', 'arrowleft'].includes(k)) inputRef.current.dir = -1;
      if (['d', 'arrowright'].includes(k)) inputRef.current.dir = 1;
      
      // Jump: Space, K, Z
      if ([' ', 'k', 'z'].includes(k)) {
        if (!inputRef.current.jumpHeld) {
           inputRef.current.jump = true;
           inputRef.current.jumpHeld = true;
        }
      }
      // Dash: Shift, X, J
      if (['shift', 'x', 'j'].includes(k)) {
        if (!inputRef.current.dashHeld) {
           inputRef.current.dash = true;
           inputRef.current.dashHeld = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['a', 'arrowleft'].includes(k) && inputRef.current.dir === -1) inputRef.current.dir = 0;
      if (['d', 'arrowright'].includes(k) && inputRef.current.dir === 1) inputRef.current.dir = 0;
      if ([' ', 'k', 'z'].includes(k)) inputRef.current.jumpHeld = false;
      if (['shift', 'x', 'j'].includes(k)) inputRef.current.dashHeld = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', () => engineRef.current?.resize());

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef.current);
    };
  }, [handleScoreUpdate, handleGameOver, handleMilestone]);

  const startGame = () => {
    sfx.init();
    if (engineRef.current) {
      engineRef.current.initGame();
      setGameState(GameState.PLAYING);
    }
  };

  const toTitle = () => {
    sfx.init();
    if (engineRef.current) {
        engineRef.current.state = GameState.TITLE;
        engineRef.current.deathRipple.active = false; 
    }
    setGameState(GameState.TITLE);
    const saved = localStorage.getItem('dc_highscore');
    if (saved) setHighScore(parseInt(saved));
    setIsRecordRun(false);
  };

  // Touch Controls
  const handleTouchStart = (action: 'left' | 'right' | 'jump' | 'dash') => (e: React.TouchEvent) => {
    e.preventDefault();
    if (action === 'left') inputRef.current.dir = -1;
    if (action === 'right') inputRef.current.dir = 1;
    if (action === 'jump') { inputRef.current.jump = true; inputRef.current.jumpHeld = true; }
    if (action === 'dash') { inputRef.current.dash = true; inputRef.current.dashHeld = true; }
  };

  const handleTouchEnd = (action: 'left' | 'right' | 'jump' | 'dash') => (e: React.TouchEvent) => {
    e.preventDefault();
    if (action === 'left' && inputRef.current.dir === -1) inputRef.current.dir = 0;
    if (action === 'right' && inputRef.current.dir === 1) inputRef.current.dir = 0;
    if (action === 'jump') inputRef.current.jumpHeld = false;
    if (action === 'dash') inputRef.current.dashHeld = false;
  };

  return (
    <div className="relative w-full h-[100dvh] bg-gray-900 flex justify-center overflow-hidden font-mono text-white">
      <div className="relative w-full h-full max-w-[540px] shadow-2xl">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* HUD */}
        <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10 flex flex-col gap-2">
           <div className="flex items-center gap-2">
              <div className={`bg-black/50 border-2 rounded-full px-4 py-1 flex items-center gap-2 transition-colors duration-300 ${
                  isRecordRun ? 'border-yellow-400 text-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'border-white/20 text-white'
              }`}>
                 <span>▲</span> <span>{hudHeight}m</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <div className="bg-black/50 border-2 border-white/20 rounded-full px-4 py-1 flex items-center gap-2 text-red-500">
                 <span>🍓</span> <span className="text-white">{hudBerries}</span>
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
            <div className="text-yellow-400 font-bold text-xl mb-8">BEST: {highScore}m</div>
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
            <div className="absolute bottom-4 right-4 text-xs text-white/20">Ver 0.9_25</div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === GameState.GAMEOVER && (
          <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-8 z-30 animate-fade-in-up">
            <div className="w-full max-w-xs bg-gray-800 border-4 border-white rounded-2xl p-6 shadow-2xl mb-6">
              <h2 className="text-4xl font-bold text-red-500 text-center mb-6 drop-shadow-sm">GAME OVER</h2>
              <div className="flex justify-between border-b border-dashed border-gray-600 pb-2 mb-3 text-gray-400 text-lg">
                <span>Height</span>
                <span className="text-white font-bold">{gameOverStats.height}m</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-600 pb-2 mb-3 text-gray-400 text-lg">
                <span>Strawberries</span>
                <span className="text-white font-bold">{gameOverStats.berries}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400 text-lg">
                <span>Rank</span>
                <span className="text-yellow-400 font-black text-4xl">{gameOverStats.rank}</span>
              </div>
            </div>
            <div className="flex gap-4 w-full max-w-xs">
              <button 
                onClick={toTitle}
                className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 active:translate-y-1 border-b-4 border-gray-900 rounded-xl font-bold transition-all"
              >
                HOME
              </button>
              <button 
                onClick={startGame}
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 active:translate-y-1 border-b-4 border-red-800 rounded-xl font-bold transition-all"
              >
                RETRY
              </button>
            </div>
          </div>
        )}

        {/* Mobile Controls Overlay - Changed md:hidden to lg:hidden to show on tablets/large phones */}
        <div className="absolute inset-0 pointer-events-none z-40 lg:hidden flex flex-col justify-end pb-8 px-4">
            <div className="flex justify-between w-full items-end">
              {/* D-Pad Area */}
              <div className="flex gap-4 pointer-events-auto">
                 <div 
                   className="w-20 h-24 bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center active:bg-white/30 transition-colors"
                   onTouchStart={handleTouchStart('left')} onTouchEnd={handleTouchEnd('left')}
                 >
                   <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                 </div>
                 <div 
                   className="w-20 h-24 bg-white/10 border-2 border-white/30 rounded-2xl flex items-center justify-center active:bg-white/30 transition-colors"
                   onTouchStart={handleTouchStart('right')} onTouchEnd={handleTouchEnd('right')}
                 >
                   <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 pointer-events-auto">
                 <div 
                   className="w-20 h-20 bg-indigo-500/40 border-2 border-white/30 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                   onTouchStart={handleTouchStart('jump')} onTouchEnd={handleTouchEnd('jump')}
                 >
                    <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>
                 </div>
                 <div 
                   className="w-20 h-20 bg-sky-500/40 border-2 border-white/30 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                   onTouchStart={handleTouchStart('dash')} onTouchEnd={handleTouchEnd('dash')}
                 >
                    <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24"><path transform="translate(0, 3)" d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41M7.41,9.41L12,4.83L16.59,9.41L18,8L12,2L6,8L7.41,9.41Z"/></svg>
                 </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
