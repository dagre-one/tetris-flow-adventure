import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import GameNode from './GameNode';

const nodeTypes = { game: GameNode };

interface GameFlowMapProps {
  completedLevels: Set<string>;
  onPlayLevel: (levelId: string) => void;
}

const baseNodes: Node[] = [
  {
    id: 'tetris',
    type: 'game',
    position: { x: 250, y: 50 },
    data: { label: 'TETRIS', description: 'Clear 5 lines', level: 1, gameId: 'tetris' },
  },
  {
    id: 'snake',
    type: 'game',
    position: { x: 250, y: 250 },
    data: { label: 'SNAKE', description: 'Eat 10 apples', level: 2, gameId: 'snake' },
  },
  {
    id: 'pong',
    type: 'game',
    position: { x: 50, y: 450 },
    data: { label: 'PONG', description: 'Coming soon', level: 3, gameId: 'pong' },
  },
  {
    id: 'breakout',
    type: 'game',
    position: { x: 450, y: 450 },
    data: { label: 'BREAKOUT', description: 'Coming soon', level: 4, gameId: 'breakout' },
  },
];

const edges: Edge[] = [
  { id: 'e1-2', source: 'tetris', target: 'snake', animated: true, style: { stroke: 'hsl(160 100% 50%)', strokeWidth: 2 } },
  { id: 'e2-3', source: 'snake', target: 'pong', animated: true, style: { stroke: 'hsl(160 100% 50% / 0.3)', strokeWidth: 2 } },
  { id: 'e2-4', source: 'snake', target: 'breakout', animated: true, style: { stroke: 'hsl(160 100% 50% / 0.3)', strokeWidth: 2 } },
];

function isUnlocked(nodeId: string, completed: Set<string>): boolean {
  const deps: Record<string, string> = { snake: 'tetris', pong: 'snake', breakout: 'snake' };
  return deps[nodeId] ? completed.has(deps[nodeId]) : false;
}

export default function GameFlowMap({ completedLevels, onPlayLevel }: GameFlowMapProps) {
  const nodes = baseNodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      completed: completedLevels.has(node.id),
      unlocked: node.id === 'tetris' || isUnlocked(node.id, completedLevels),
      onPlay: onPlayLevel,
    },
  }));

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 15% 18%)" />
      </ReactFlow>
    </div>
  );
}
