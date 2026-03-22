import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const TICK_SPEED = 500;
const WIN_SCORE = 500;
const MATCH_MIN = 3;

type Board = number[][];

// Candy types: 1-5 (0 = empty)
const CANDY_COLORS: { [key: number]: string } = {
  0: 'bg-muted/20',
  1: 'bg-[hsl(0_80%_55%)]',      // Red
  2: 'bg-[hsl(160_100%_50%)]',    // Green (primary)
  3: 'bg-[hsl(190_100%_50%)]',    // Cyan (secondary)
  4: 'bg-[hsl(40_100%_55%)]',     // Amber (accent)
  5: 'bg-[hsl(280_80%_60%)]',     // Purple
};

const CANDY_GLOWS: { [key: number]: string } = {
  0: '',
  1: 'shadow-[0_0_6px_hsl(0_80%_55%/0.6)]',
  2: 'shadow-[0_0_6px_hsl(160_100%_50%/0.6)]',
  3: 'shadow-[0_0_6px_hsl(190_100%_50%/0.6)]',
  4: 'shadow-[0_0_6px_hsl(40_100%_55%/0.6)]',
  5: 'shadow-[0_0_6px_hsl(280_80%_60%/0.6)]',
};

const CANDY_COUNT = 5;

const TETROMINOES: number[][][] = [
  [[1,1,1,1]],           // I
  [[1,1],[1,1]],         // O
  [[0,1,0],[1,1,1]],     // T
  [[0,1,1],[1,1,0]],     // S
  [[1,1,0],[0,1,1]],     // Z
  [[1,0,0],[1,1,1]],     // J
  [[0,0,1],[1,1,1]],     // L
];

interface Piece {
  shape: number[][]; // 0 = empty, >0 = candy type
  x: number;
  y: number;
}

function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function randomPiece(): Piece {
  const template = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  // Each cell gets a random candy type
  const shape = template.map(row =>
    row.map(cell => (cell ? Math.floor(Math.random() * CANDY_COUNT) + 1 : 0))
  );
  return { shape, x: Math.floor((BOARD_WIDTH - shape[0].length) / 2), y: 0 };
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

function merge(board: Board, shape: number[][], x: number, y: number): Board {
  const newBoard = board.map(r => [...r]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c] && y + r >= 0)
        newBoard[y + r][x + c] = shape[r][c];
  return newBoard;
}

// Find all cells that are part of a 3+ match (horizontal or vertical)
function findMatches(board: Board): Set<string> {
  const matched = new Set<string>();

  // Horizontal matches
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c <= BOARD_WIDTH - MATCH_MIN; c++) {
      const val = board[r][c];
      if (!val) continue;
      let len = 1;
      while (c + len < BOARD_WIDTH && board[r][c + len] === val) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < BOARD_WIDTH; c++) {
    for (let r = 0; r <= BOARD_HEIGHT - MATCH_MIN; r++) {
      const val = board[r][c];
      if (!val) continue;
      let len = 1;
      while (r + len < BOARD_HEIGHT && board[r + len][c] === val) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
      }
    }
  }

  return matched;
}

// Remove matched cells and apply gravity
function clearMatches(board: Board, matches: Set<string>): Board {
  const newBoard = board.map(r => [...r]);
  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    newBoard[r][c] = 0;
  });
  return newBoard;
}

function applyGravity(board: Board): Board {
  const newBoard = createBoard();
  for (let c = 0; c < BOARD_WIDTH; c++) {
    let writeRow = BOARD_HEIGHT - 1;
    for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
      if (board[r][c]) {
        newBoard[writeRow][c] = board[r][c];
        writeRow--;
      }
    }
  }
  return newBoard;
}

// Also clear full lines (traditional Tetris)
function clearFullLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter(row => row.some(c => c === 0));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(0));
  return { board: [...empty, ...remaining], cleared };
}

// Process all candy crush matches + full lines, returns final board and total score
function processBoard(board: Board): { board: Board; totalScore: number } {
  let current = board;
  let totalScore = 0;
  let chainMultiplier = 1;

  // First: clear full lines (Tetris style)
  const { board: afterLines, cleared: linesCleared } = clearFullLines(current);
  current = afterLines;
  totalScore += linesCleared * 100;

  // Then: cascade candy crush matches
  let maxIterations = 20;
  while (maxIterations-- > 0) {
    const matches = findMatches(current);
    if (matches.size === 0) break;
    totalScore += matches.size * 10 * chainMultiplier;
    current = clearMatches(current, matches);
    current = applyGravity(current);
    chainMultiplier++;
  }

  return { board: current, totalScore };
}

interface TetrisGameProps {
  onWin: () => void;
  onClose: () => void;
}

export default function TetrisGame({ onWin, onClose }: TetrisGameProps) {
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());

  const drop = useCallback(() => {
    if (gameOver) return;
    setPiece(prev => {
      if (!collides(board, prev.shape, prev.x, prev.y + 1)) {
        return { ...prev, y: prev.y + 1 };
      }
      // Lock piece
      const merged = merge(board, prev.shape, prev.x, prev.y);

      // Find matches for flash effect
      const matches = findMatches(merged);
      if (matches.size > 0) {
        setFlashCells(matches);
        setTimeout(() => setFlashCells(new Set()), 300);
      }

      const { board: processed, totalScore } = processBoard(merged);
      setBoard(processed);

      if (totalScore > 0) {
        setCombo(prev => prev + 1);
        setScore(s => {
          const newScore = s + totalScore;
          if (newScore >= WIN_SCORE) onWin();
          return newScore;
        });
      } else {
        setCombo(0);
      }

      const next = randomPiece();
      if (collides(processed, next.shape, next.x, next.y)) {
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
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setFlashCells(new Set());
  };

  // Render board with current piece overlaid
  const displayBoard = board.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < BOARD_HEIGHT)
        displayBoard[piece.y + r][piece.x + c] = piece.shape[r][c];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-xs">
          <h2 className="font-pixel text-primary text-glow text-sm">TETRIS CRUSH</h2>
          <button onClick={onClose} className="font-pixel text-muted-foreground hover:text-foreground text-xs">
            ✕ ESC
          </button>
        </div>

        <div className="flex gap-6">
          <div className="border-2 border-primary/40 neon-glow rounded-sm p-0.5 bg-background">
            {displayBoard.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((cell, ci) => {
                  const isFlashing = flashCells.has(`${ri},${ci}`);
                  return (
                    <div
                      key={ci}
                      className={`w-5 h-5 border border-border/20 rounded-[2px] transition-all duration-150
                        ${CANDY_COLORS[cell]}
                        ${cell ? CANDY_GLOWS[cell] : ''}
                        ${cell ? 'opacity-90' : 'opacity-100'}
                        ${isFlashing ? 'animate-pulse scale-110 brightness-150' : ''}
                      `}
                    >
                      {cell > 0 && (
                        <div className="w-full h-full flex items-center justify-center text-[7px] font-bold opacity-60 select-none">
                          {['', '●', '◆', '★', '▲', '♥'][cell]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 font-pixel text-xs min-w-[120px]">
            <div>
              <div className="text-muted-foreground mb-1">SCORE</div>
              <div className="text-foreground text-glow">{score}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">GOAL</div>
              <div className="text-foreground text-glow">{score}/{WIN_SCORE}</div>
            </div>
            {combo > 1 && (
              <motion.div
                key={combo}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-accent font-pixel text-xs"
              >
                {combo}x COMBO!
              </motion.div>
            )}
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (score / WIN_SCORE) * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              <div className="text-muted-foreground text-[9px]">CANDIES</div>
              <div className="flex flex-wrap gap-1">
                {[1,2,3,4,5].map(c => (
                  <div key={c} className={`w-4 h-4 rounded-[2px] ${CANDY_COLORS[c]} ${CANDY_GLOWS[c]} flex items-center justify-center text-[6px]`}>
                    {['', '●', '◆', '★', '▲', '♥'][c]}
                  </div>
                ))}
              </div>
              <div className="text-muted-foreground text-[8px] mt-1">Match 3+ to clear!</div>
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
          Arrow keys to move & rotate. Match 3+ same candies or clear lines! Score {WIN_SCORE} to win!
        </p>
      </div>
    </motion.div>
  );
}
