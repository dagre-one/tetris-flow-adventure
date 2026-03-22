import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

const GRID = 20;
const CELL = 20;
const TICK = 150;
const WIN_SCORE = 10;

type Point = { x: number; y: number };
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

function randomFood(snake: Point[]): Point {
  let p: Point;
  do {
    p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some(s => s.x === p.x && s.y === p.y));
  return p;
}

interface SnakeGameProps {
  onWin: () => void;
  onClose: () => void;
}

export default function SnakeGame({ onWin, onClose }: SnakeGameProps) {
  const initial: Point[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  const [snake, setSnake] = useState<Point[]>(initial);
  const [food, setFood] = useState<Point>(() => randomFood(initial));
  const [dir, setDir] = useState<Dir>('RIGHT');
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const dirRef = useRef<Dir>('RIGHT');
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      const map: Record<string, Dir> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      };
      const newDir = map[e.key];
      if (!newDir) return;
      const opp: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
      if (opp[newDir] !== dirRef.current) {
        dirRef.current = newDir;
        setDir(newDir);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        const d = dirRef.current;
        if (d === 'UP') head.y--;
        if (d === 'DOWN') head.y++;
        if (d === 'LEFT') head.x--;
        if (d === 'RIGHT') head.x++;

        // Wall collision
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
          setGameOver(true);
          return prev;
        }
        // Self collision
        if (prev.some(s => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore(s => {
            const ns = s + 1;
            if (ns >= WIN_SCORE) onWin();
            return ns;
          });
          setFood(randomFood(newSnake));
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, TICK);
    return () => clearInterval(interval);
  }, [gameOver, food, onWin]);

  const restart = () => {
    const init: Point[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    setSnake(init);
    setFood(randomFood(init));
    dirRef.current = 'RIGHT';
    setDir('RIGHT');
    setScore(0);
    setGameOver(false);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="outline-none flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full" style={{ maxWidth: GRID * CELL + 4 }}>
          <h2 className="font-pixel text-secondary text-glow-cyan text-sm">SNAKE</h2>
          <button onClick={onClose} className="font-pixel text-muted-foreground hover:text-foreground text-xs">✕ ESC</button>
        </div>

        <div className="flex gap-6">
          <div
            className="relative border-2 border-secondary/40 neon-glow-cyan rounded-sm bg-background"
            style={{ width: GRID * CELL, height: GRID * CELL }}
          >
            {/* Food */}
            <div
              className="absolute bg-destructive rounded-full"
              style={{ width: CELL - 2, height: CELL - 2, left: food.x * CELL + 1, top: food.y * CELL + 1 }}
            />
            {/* Snake */}
            {snake.map((seg, i) => (
              <div
                key={i}
                className={`absolute rounded-sm ${i === 0 ? 'bg-primary' : 'bg-primary/70'}`}
                style={{ width: CELL - 2, height: CELL - 2, left: seg.x * CELL + 1, top: seg.y * CELL + 1 }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4 font-pixel text-xs min-w-[120px]">
            <div>
              <div className="text-muted-foreground mb-1">SCORE</div>
              <div className="text-foreground text-glow">{score}/{WIN_SCORE}</div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-secondary h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (score / WIN_SCORE) * 100)}%` }} />
              </div>
            </div>
            {gameOver && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="text-destructive">GAME OVER</div>
                <button onClick={restart} className="bg-secondary text-secondary-foreground px-3 py-2 rounded text-[10px] hover:opacity-80">RETRY</button>
              </div>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs font-body">Arrow keys to steer. Eat {WIN_SCORE} apples to win!</p>
      </div>
    </motion.div>
  );
}
