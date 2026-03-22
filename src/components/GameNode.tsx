import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Lock, Check, Play } from 'lucide-react';

interface GameNodeData {
  label: string;
  description: string;
  level: number;
  gameId: string;
  completed?: boolean;
  unlocked?: boolean;
  onPlay?: (id: string) => void;
}

export default function GameNode({ data }: NodeProps) {
  const { label, description, level, gameId, completed, unlocked, onPlay } = data as unknown as GameNodeData;
  const playable = unlocked || completed;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary !border-primary" />
      <motion.div
        whileHover={playable ? { scale: 1.05 } : {}}
        whileTap={playable ? { scale: 0.97 } : {}}
        onClick={() => playable && !completed && onPlay?.(gameId)}
        className={`
          relative px-6 py-4 rounded-lg border-2 min-w-[160px] text-center cursor-pointer select-none
          ${completed
            ? 'border-primary bg-primary/10 neon-glow'
            : playable
              ? 'border-secondary bg-secondary/10 neon-glow-cyan hover:bg-secondary/20'
              : 'border-muted bg-muted/20 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {completed ? (
            <Check className="w-4 h-4 text-primary" />
          ) : !playable ? (
            <Lock className="w-3 h-3 text-muted-foreground" />
          ) : (
            <Play className="w-3 h-3 text-secondary" />
          )}
          <span className="font-pixel text-xs text-foreground">
            {label}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground font-body">{description}</div>
        <div className="absolute -top-2 -right-2 bg-card border border-border rounded-full w-6 h-6 flex items-center justify-center">
          <span className="font-pixel text-[8px] text-muted-foreground">L{level}</span>
        </div>
      </motion.div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !border-primary" />
    </>
  );
}
