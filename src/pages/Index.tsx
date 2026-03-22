import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import GameFlowMap from '@/components/GameFlowMap';
import TetrisGame from '@/components/TetrisGame';

const Index = () => {
  const [completedLevels, setCompletedLevels] = useState<Set<string>>(new Set());
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const handleWin = () => {
    if (activeGame) {
      setCompletedLevels(prev => new Set([...prev, activeGame]));
      setActiveGame(null);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-pixel text-primary text-glow text-sm tracking-wider">
          ARCADE FLOW
        </h1>
        <div className="font-pixel text-xs text-muted-foreground">
          {completedLevels.size} / 4 CLEARED
        </div>
      </div>

      {/* Flow Map */}
      <GameFlowMap
        completedLevels={completedLevels}
        onPlayLevel={(id) => setActiveGame(id)}
      />

      {/* Active Game Overlay */}
      <AnimatePresence>
        {activeGame === 'tetris' && (
          <TetrisGame
            onWin={handleWin}
            onClose={() => setActiveGame(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
