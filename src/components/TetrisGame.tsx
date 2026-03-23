import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 16;
const TICK_SPEED = 500;
const WIN_SCORE = 500;
const MATCH_MIN = 4;

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

// Detect 2x2 “box” shape of the same candy type (secondary clear rule)
function findBoxShapes(board: Board): { coords: Set<string>; count: number } {
  const coords = new Set<string>();
  let count = 0;

  for (let r = 0; r < BOARD_HEIGHT - 1; r++) {
    for (let c = 0; c < BOARD_WIDTH - 1; c++) {
      const val = board[r][c];
      if (!val) continue;
      if (board[r][c + 1] === val && board[r + 1][c] === val && board[r + 1][c + 1] === val) {
        count++;
        coords.add(`${r},${c}`);
        coords.add(`${r},${c + 1}`);
        coords.add(`${r + 1},${c}`);
        coords.add(`${r + 1},${c + 1}`);
      }
    }
  }

  return { coords, count };
}

// Detect Tetromino-like shapes (I, O, T, L, J, S, Z) same-value and 4-cell
const BASE_SHAPE_PATTERNS: Record<string, [number, number][]> = {
  I: [[0,0], [0,1], [0,2], [0,3]],
  O: [[0,0], [0,1], [1,0], [1,1]],
  T: [[0,1], [1,0], [1,1], [1,2]],
  L: [[0,0], [1,0], [2,0], [2,1]],
  J: [[0,1], [1,1], [2,1], [2,0]],
  S: [[0,1], [0,2], [1,0], [1,1]],
  Z: [[0,0], [0,1], [1,1], [1,2]],
};

function normalizePattern(pattern: [number, number][]): [number, number][] {
  const minRow = Math.min(...pattern.map(p => p[0]));
  const minCol = Math.min(...pattern.map(p => p[1]));
  return pattern.map(([r, c]) => [r - minRow, c - minCol]);
}

function stringifyPattern(pattern: [number, number][]): string {
  return pattern
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join('|');
}

function rotatePattern(pattern: [number, number][]): [number, number][] {
  return pattern.map(([r, c]) => [c, -r]);
}

const SHAPE_ORIENTATIONS: Record<string, [number, number][][]> = {
  I: [
    [[0,0],[0,1],[0,2],[0,3]], // horizontal
    [[0,0],[1,0],[2,0],[3,0]], // vertical
  ],
  O: [
    [[0,0],[0,1],[1,0],[1,1]], // all rotations same
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]], // up
    [[0,1],[1,1],[1,2],[2,1]], // right
    [[1,0],[1,1],[1,2],[2,1]], // down
    [[0,1],[1,0],[1,1],[2,1]], // left
  ],
  L: [
    [[0,0],[1,0],[2,0],[2,1]], // up
    [[0,0],[0,1],[0,2],[1,0]], // right
    [[0,1],[1,1],[2,0],[2,1]], // down
    [[0,2],[1,0],[1,1],[1,2]], // left
  ],
  J: [
    [[0,1],[1,1],[2,1],[2,0]], // up
    [[0,0],[1,0],[1,1],[1,2]], // right
    [[0,0],[0,1],[1,1],[2,1]], // down
    [[0,0],[0,1],[0,2],[1,2]], // left
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]], // horizontal
    [[0,0],[1,0],[1,1],[2,1]], // vertical
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]], // horizontal
    [[0,1],[1,0],[1,1],[2,0]], // vertical
  ],
};

function findLineShapes(board: Board): { coords: Set<string>; count: number } {
  const coords = new Set<string>();
  let count = 0;
  // Horizontal
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    let runVal = 0;
    let runLen = 0;
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      const v = c < BOARD_WIDTH ? board[r][c] : 0;
      if (v !== 0 && v === runVal) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          count++;
          for (let k = c - runLen; k < c; k++) coords.add(`${r},${k}`);
        }
        runVal = v;
        runLen = v === 0 ? 0 : 1;
      }
    }
  }
  // Vertical
  for (let c = 0; c < BOARD_WIDTH; c++) {
    let runVal = 0;
    let runLen = 0;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      const v = r < BOARD_HEIGHT ? board[r][c] : 0;
      if (v !== 0 && v === runVal) {
        runLen++;
      } else {
        if (runLen >= MATCH_MIN) {
          count++;
          for (let k = r - runLen; k < r; k++) coords.add(`${k},${c}`);
        }
        runVal = v;
        runLen = v === 0 ? 0 : 1;
      }
    }
  }
  return { coords, count };
}
function findTetrominoShapes(board: Board): { coords: Set<string>; counts: Record<string, number> } {
  const coords = new Set<string>();
  const counts: Record<string, number> = { I: 0, O: 0, T: 0, L: 0, J: 0, S: 0, Z: 0 };

  for (const [shape, orientations] of Object.entries(SHAPE_ORIENTATIONS)) {
    for (const pattern of orientations) {
      for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          const base = board[r][c];
          if (!base) continue;
          let match = true;
          for (const [dr, dc] of pattern) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= BOARD_HEIGHT || cc < 0 || cc >= BOARD_WIDTH || board[rr][cc] !== base) {
              match = false;
              break;
            }
          }
          if (match) {
            counts[shape]++;
            for (const [dr, dc] of pattern) {
              coords.add(`${r + dr},${c + dc}`);
            }
          }
        }
      }
    }
  }

  return { coords, counts };
}

// Process all candy crush matches + full lines + box shapes, returns final board and stats
function processBoard(board: Board): { board: Board; totalScore: number; rowsCleared: number; boxesCleared: number; lineShapes: number; shapeCounts: Record<string, number> } {
  let current = board;
  let totalScore = 0;
  let rowsCleared = 0;
  let boxesCleared = 0;
  let lineShapes = 0;
  let shapeCounts: Record<string, number> = { I: 0, O: 0, T: 0, L: 0, J: 0, S: 0, Z: 0 };
  let chainMultiplier = 1;

  // Cascade clearing: matches, boxes, line shapes, tetromino shapes, full lines
  let maxIterations = 20;
  while (maxIterations-- > 0) {
    let matches = findMatches(current);

    // Add secondary known-shape rule: 2x2 boxes
    const { coords: boxCoords, count: boxCount } = findBoxShapes(current);
    if (boxCount > 0) {
      boxesCleared += boxCount;
      boxCoords.forEach(k => matches.add(k));
    }

    // Add line shape detection (4+ continuous)
    const { coords: lineCoords, count: lineCount } = findLineShapes(current);
    if (lineCount > 0) {
      lineShapes += lineCount;
      lineCoords.forEach(k => matches.add(k));
    }

    // Add tetromino style shape detection
    const { coords: tetroCoords, counts: foundShapeCounts } = findTetrominoShapes(current);
    const tetroCount = Object.values(foundShapeCounts).reduce((a, b) => a + b, 0);
    if (tetroCount > 0) {
      for (const shape of Object.keys(shapeCounts)) {
        shapeCounts[shape] += foundShapeCounts[shape] || 0;
      }
      tetroCoords.forEach(k => matches.add(k));
    }

    // Check for full lines
    const { board: afterLines, cleared: lineClears } = clearFullLines(current);
    const hasFullLines = lineClears > 0;

    if (matches.size === 0 && !hasFullLines) break;

    // Clear full lines first if any
    if (hasFullLines) {
      rowsCleared += lineClears;
      current = afterLines;
    }

    // Clear other matches if any
    if (matches.size > 0) {
      current = clearMatches(current, matches);
    }

    // Apply gravity after clearing
    current = applyGravity(current);

    // Score calculation
    let scoreThisTurn = 0;
    if (matches.size > 0) {
      scoreThisTurn += matches.size * 10 + boxCount * 20 + lineCount * 20;
    }
    if (tetroCount > 0) {
      scoreThisTurn += tetroCount * 30 * tetroCount; // Shape combo: multiply by number of shapes
    }
    if (hasFullLines) {
      scoreThisTurn += lineClears * 100;
    }
    totalScore += scoreThisTurn * chainMultiplier;

    chainMultiplier++;
  }

  return { board: current, totalScore, rowsCleared, boxesCleared, lineShapes, shapeCounts };
}

interface TetrisGameProps {
  onWin?: () => void;
  onClose: () => void;
  isOverlay?: boolean;
}

export default function TetrisGame({ onWin, onClose, isOverlay = true }: TetrisGameProps) {
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [rowsMade, setRowsMade] = useState(0);
  const [boxesMade, setBoxesMade] = useState(0);
  const [lineMade, setLineMade] = useState(0);
  const [shapeMade, setShapeMade] = useState<Record<string, number>>({ I: 0, O: 0, T: 0, L: 0, J: 0, S: 0, Z: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (gameOver || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const cellSize = window.innerWidth < 640 ? 32 : 24; // 32px on mobile, 24px on sm+
    const boardHeight = BOARD_HEIGHT * cellSize;

    if (y <= boardHeight) {
      const col = Math.floor(x / cellSize);
      if (col >= 0 && col < BOARD_WIDTH) {
        // Move piece to tapped column (center the piece on the tapped column)
        let newX = col - Math.floor(piece.shape[0].length / 2);
        newX = Math.max(0, Math.min(BOARD_WIDTH - piece.shape[0].length, newX));

        // Try to move horizontally to the new position
        if (!collides(board, piece.shape, newX, piece.y)) {
          setPiece(prev => {
            // Instantly drop the piece to the bottom
            let dropY = prev.y;
            const movedPiece = { ...prev, x: newX };
            while (!collides(board, movedPiece.shape, movedPiece.x, dropY + 1)) {
              dropY++;
            }

            // Lock the piece at the bottom
            const finalPiece = { ...movedPiece, y: dropY };
            const merged = merge(board, finalPiece.shape, finalPiece.x, finalPiece.y);

            // Find matches for flash effect
            const matches = findMatches(merged);
            if (matches.size > 0) {
              setFlashCells(matches);
              setTimeout(() => setFlashCells(new Set()), 300);
            }

            const { board: processed, totalScore, rowsCleared, boxesCleared, lineShapes, shapeCounts } = processBoard(merged);
            setBoard(processed);

            if (totalScore > 0) {
              setCombo(prev => prev + 1);
              setScore(s => s + totalScore);
              setRowsMade(prev => prev + rowsCleared);
              setBoxesMade(prev => prev + boxesCleared);
              setLineMade(prev => prev + lineShapes);
              setShapeMade(prev => {
                const next = { ...prev };
                Object.entries(shapeCounts).forEach(([shape, count]) => {
                  next[shape] = (next[shape] || 0) + count;
                });
                return next;
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
        }
      }
    }
  }, [board, piece, gameOver]);

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

      const { board: processed, totalScore, rowsCleared, boxesCleared, lineShapes, shapeCounts } = processBoard(merged);
      setBoard(processed);

      if (totalScore > 0) {
        setCombo(prev => prev + 1);
        setScore(s => s + totalScore);
        setRowsMade(prev => prev + rowsCleared);
        setBoxesMade(prev => prev + boxesCleared);
        setLineMade(prev => prev + lineShapes);
        setShapeMade(prev => {
          const next = { ...prev };
          Object.entries(shapeCounts).forEach(([shape, count]) => {
            next[shape] = (next[shape] || 0) + count;
          });
          return next;
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
  }, [board, gameOver]);

  useEffect(() => {
    const interval = setInterval(drop, TICK_SPEED);
    return () => clearInterval(interval);
  }, [drop]);

  useEffect(() => {
    if (gameOver) {
      setModalOpen(true);
    }
  }, [gameOver]);

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
      initial={{ scale: isOverlay ? 0.8 : 1, opacity: isOverlay ? 0 : 1 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: isOverlay ? 0.8 : 1, opacity: isOverlay ? 0 : 1 }}
      className={isOverlay ? "fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm" : "flex flex-col h-screen select-none"}
    >
      <div className="flex flex-col h-full">
        <div className="hidden sm:flex items-center justify-between w-full max-w-xs px-4 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-pixel text-primary text-glow text-sm">TETRIS CRUSH</h2>
            <button onClick={() => setModalOpen(true)} className="sm:hidden text-muted-foreground hover:text-foreground text-sm">☰</button>
          </div>
          <button onClick={onClose} className="font-pixel text-muted-foreground hover:text-foreground text-xs">
            ✕ ESC
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col sm:flex-row gap-6">
          <div className="relative border-2 border-primary/40 neon-glow rounded-sm p-0.5 bg-background" ref={boardRef} onTouchStart={handleTouch}>
            <div className="absolute top-2 left-2 z-10 bg-background/70 text-foreground px-2 py-1 rounded text-[10px] font-pixel">
              <div>Score: {score}</div>
              <div className="text-[8px] mt-1">Rows: {rowsMade}</div>
              <div className="text-[8px]">Shapes:</div>
              <div className="text-[8px]">S+Z: {shapeMade.S + shapeMade.Z}</div>
              <div className="text-[8px]">T: {shapeMade.T}</div>
              <div className="text-[8px]">L: {shapeMade.L}</div>
              <div className="text-[8px]">O: {shapeMade.O}</div>
            </div>
            <button
              onClick={restart}
              className="absolute top-2 right-2 z-10 bg-muted text-muted-foreground hover:bg-muted/80 px-2 py-1 rounded text-[10px]"
            >
              Reset
            </button>
            {displayBoard.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((cell, ci) => {
                  const isFlashing = flashCells.has(`${ri},${ci}`);
                  return (
                    <div
                      key={ci}
                      className={`w-8 h-8 sm:w-6 sm:h-6 border border-border/20 rounded-[2px] transition-all duration-150
                        ${CANDY_COLORS[cell]}
                        ${cell ? CANDY_GLOWS[cell] : ''}
                        ${cell ? 'opacity-90' : 'opacity-100'}
                        ${isFlashing ? 'animate-pulse scale-110 brightness-150' : ''}
                      `}
                    >
                      {cell > 0 && (
                        <div className="w-full h-full flex items-center justify-center text-[12px] sm:text-[10px] font-bold opacity-60 select-none">
                          {['', '●', '◆', '★', '▲', '♥'][cell]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="hidden sm:flex flex-col gap-4 font-pixel text-xs min-w-[120px]">
            <div>
              <div className="text-muted-foreground mb-1">SCORE</div>
              <div className="text-foreground text-glow">{score}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">GOAL</div>
              <div className="text-foreground text-glow">{score} points</div>
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
                  style={{ width: `${Math.min(100, (score % WIN_SCORE) / WIN_SCORE * 100)}%` }}
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
              <div className="text-muted-foreground text-[8px] mt-1">Match 4+ to clear (line/box/tetromino). Track rows, box + shape counts.</div>
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
      </div>

      {/* Bottom controls for mobile */}
      <div className="sm:hidden grid grid-cols-3 gap-2 mt-1 w-full max-w-xs mx-auto p-2 pb-6">
        <button
          onClick={() => setPiece(prev => !collides(board, prev.shape, prev.x - 1, prev.y) ? { ...prev, x: prev.x - 1 } : prev)}
          className="bg-muted text-muted-foreground hover:bg-muted/80 p-4 rounded font-bold"
        >
          ←
        </button>
        <button
          onClick={() => {
            const rotated = rotate(piece.shape);
            if (!collides(board, rotated, piece.x, piece.y)) setPiece(prev => ({ ...prev, shape: rotated }));
          }}
          className="bg-muted text-muted-foreground hover:bg-muted/80 p-4 rounded font-bold"
        >
          ↻
        </button>
        <button
          onClick={() => setPiece(prev => !collides(board, prev.shape, prev.x + 1, prev.y) ? { ...prev, x: prev.x + 1 } : prev)}
          className="bg-muted text-muted-foreground hover:bg-muted/80 p-4 rounded font-bold"
        >
          →
        </button>
      </div>

      {/* Modal for game details on mobile */}
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 flex items-center justify-center bg-background/90 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-background border border-border rounded-lg p-6 max-w-sm w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-pixel text-primary text-glow text-sm">GAME INFO</h3>
                  <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <div className="flex flex-col gap-4 font-pixel text-xs">
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="hidden sm:block text-muted-foreground text-xs font-body">
          Desktop: Arrow keys to move & rotate. Mobile: Tap shape to rotate, left/right screen to move, below board to speed up. Match 4+ same candies, full lines, box shapes, and tetromino shapes for bonus points.
        </p>
      </div>
    </motion.div>
  );
}
