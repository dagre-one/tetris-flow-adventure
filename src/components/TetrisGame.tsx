import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const TICK_SPEED = 500;
const WIN_LINES = 5;

type Board = number[][];

const TETROMINOES: { [key: string]: { shape: number[][]; color: number } } = {
  I: { shape: [[1,1,1,1]], color: 1 },
  O: { shape: [[1,1],[1,1]], color: 2 },
  T: { shape: [[0,1,0],[1,1,1]], color: 3 },
  S: { shape: [[0,1,1],[1,1,0]], color: 4 },
  Z: { shape: [[1,1,0],[0,1,1]], color: 5 },
  J: { shape: [[1,0,0],[1,1,1]], color: 6 },
  L: { shape: [[0,0,1],[1,1,1]], color: 7 },
};

const COLORS: { [key: number]: string } = {
  0: 'bg-muted/30',
  1: 'bg-secondary',
  2: 'bg-accent',
  3: 'bg-primary',
  4: 'bg-destructive',
  5: 'bg-primary',
  6: 'bg-secondary',
  7: 'bg-accent',
};

const PIECE_NAMES = Object.keys(TETROMINOES);

function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function randomPiece() {
  const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  const t = TETROMINOES[name];
  return { shape: t.shape.map(r => [...r]), color: t.color, x: 3, y: 0 };
}

function rotate(shape: number[][]) {
  const rows = shape.length, cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rotated[c][rows - 1 - r] = shape[r][c];
  return rotated;
}

function collides(board: Board, shape: number[][], x: number, y: number) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = x + c, ny = y + r;
        if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
  return false;
}

function merge(board: Board, shape: number[][], x: number, y: number, color: number): Board {
  const newBoard = board.map(r => [...r]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c] && y + r >= 0)
        newBoard[y + r][x + c] = color;
  return newBoard;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter(row => row.some(c => c === 0));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(0));
  return { board: [...empty, ...remaining], cleared };
}

interface TetrisGameProps {
  onWin: () => void;
  onClose: () => void;
}

export default function TetrisGame({ onWin, onClose }: TetrisGameProps) {
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameRef = useRef<HTMLDivElement>(null);

  const drop = useCallback(() => {
    if (gameOver) return;
    setPiece(prev => {
      if (!collides(board, prev.shape, prev.x, prev.y + 1)) {
        return { ...prev, y: prev.y + 1 };
      }
      // Lock piece
      const merged = merge(board, prev.shape, prev.x, prev.y, prev.color);
      const { board: cleared, cleared: linesCleared } = clearLines(merged);
      setBoard(cleared);
      setLines(l => {
        const newLines = l + linesCleared;
        if (newLines >= WIN_LINES) onWin();
        return newLines;
      });
      setScore(s => s + linesCleared * 100 + 10);
      const next = randomPiece();
      if (collides(cleared, next.shape, next.x, next.y)) {
        setGameOver(true);
      }
      return next;
    });
  }, [board, gameOver, onWin]);

  useEffect(() => {
    const interval = setInterval(drop, TICK_SPEED);
    return () => clearInterval(interval);
  }, [drop]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      setPiece(prev => {
        if (e.key === 'ArrowLeft' && !collides(board, prev.shape, prev.x - 1, prev.y))
          return { ...prev, x: prev.x - 1 };
        if (e.key === 'ArrowRight' && !collides(board, prev.shape, prev.x + 1, prev.y))
          return { ...prev, x: prev.x + 1 };
        if (e.key === 'ArrowDown' && !collides(board, prev.shape, prev.x, prev.y + 1))
          return { ...prev, y: prev.y + 1 };
        if (e.key === 'ArrowUp') {
          const rotated = rotate(prev.shape);
          if (!collides(board, rotated, prev.x, prev.y))
            return { ...prev, shape: rotated };
        }
        return prev;
      });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [board, gameOver]);

  const restart = () => {
    setBoard(createBoard());
    setPiece(randomPiece());
    setLines(0);
    setScore(0);
    setGameOver(false);
  };

  // Render board with current piece overlaid
  const displayBoard = board.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < BOARD_HEIGHT)
        displayBoard[piece.y + r][piece.x + c] = piece.color;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div
        className="outline-none flex flex-col items-center gap-4"
      >
        <div className="flex items-center justify-between w-full max-w-xs">
          <h2 className="font-pixel text-primary text-glow text-sm">TETRIS</h2>
          <button onClick={onClose} className="font-pixel text-muted-foreground hover:text-foreground text-xs">
            ✕ ESC
          </button>
        </div>

        <div className="flex gap-6">
          <div className="border-2 border-primary/40 neon-glow rounded-sm p-0.5 bg-background">
            {displayBoard.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className={`w-5 h-5 border border-border/20 ${COLORS[cell]} ${cell ? 'opacity-90' : 'opacity-100'}`}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 font-pixel text-xs min-w-[120px]">
            <div>
              <div className="text-muted-foreground mb-1">SCORE</div>
              <div className="text-foreground text-glow">{score}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">LINES</div>
              <div className="text-foreground text-glow">{lines}/{WIN_LINES}</div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (lines / WIN_LINES) * 100)}%` }}
                />
              </div>
            </div>
            {gameOver && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="text-destructive">GAME OVER</div>
                <button
                  onClick={restart}
                  className="bg-primary text-primary-foreground px-3 py-2 rounded text-[10px] hover:opacity-80"
                >
                  RETRY
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs font-body">
          Arrow keys to move & rotate. Clear {WIN_LINES} lines to win!
        </p>
      </div>
    </motion.div>
  );
}
