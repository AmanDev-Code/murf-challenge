'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Position,
  MarkerType,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Agent color mapping (consistent with agents-tab.tsx)
const AGENT_COLORS: Record<string, string> = {
  triage: '#f5a623',
  calculator: '#4fc3f7',
  schemes: '#81c784',
  accounts: '#ba68c8',
  security: '#ef5350',
  escalation: '#ff7043',
};

const AGENT_LABELS: Record<string, string> = {
  triage: 'Triage',
  calculator: 'Calculator',
  schemes: 'Schemes',
  accounts: 'Accounts',
  security: 'Security',
  escalation: 'Escalation',
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  triage: 'Dispatcher · Greets · Routes',
  calculator: 'EMI · Loan · FD · Reasoning',
  schemes: 'Yojana · Gold · RBI · Docs',
  accounts: 'Balance · UPI · Memory',
  security: 'Creds · Forget · Transfer',
  escalation: 'Fraud · Tickets · Helplines',
};

interface FlowLink {
  source: string;
  target: string;
  value: number;
  avg_time_s?: number;
}

interface AgentFlowGraphProps {
  links: FlowLink[];
  className?: string;
}

/**
 * Custom node component for agents in the flow graph.
 */
function AgentNode({ data }: { data: any }) {
  const color = AGENT_COLORS[data.agentId] || '#888';
  const isCenter = data.agentId === 'triage';

  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm transition-all hover:scale-105 ${
        isCenter ? 'min-w-[160px]' : 'min-w-[140px]'
      }`}
      style={{
        borderColor: color,
        background: `${color}15`,
        boxShadow: `0 4px 20px ${color}30`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-sm font-semibold text-white">{data.label}</span>
      </div>
      <div className="mt-1 text-[10px] text-white/50">{data.description}</div>
      {data.activations > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${color}30`, color }}
          >
            {data.activations}× activated
          </span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

/**
 * Build the flow graph layout — triage at center, specialists in a ring.
 */
function buildGraph(links: FlowLink[]): { nodes: Node[]; edges: Edge[] } {
  // Count activations per agent from flow data
  const activations: Record<string, number> = {};
  for (const link of links) {
    activations[link.target] = (activations[link.target] || 0) + link.value;
  }

  // Triage is center
  const centerX = 350;
  const centerY = 280;
  const radius = 220;

  // Position specialists in a ring around triage
  const specialists = ['calculator', 'schemes', 'accounts', 'security', 'escalation'];
  const angleStep = (2 * Math.PI) / specialists.length;
  const startAngle = -Math.PI / 2; // Start from top

  const nodes: Node[] = [
    {
      id: 'triage',
      type: 'agent',
      position: { x: centerX - 80, y: centerY - 30 },
      data: {
        label: AGENT_LABELS.triage,
        description: AGENT_DESCRIPTIONS.triage,
        agentId: 'triage',
        activations: activations['triage'] || 0,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
  ];

  specialists.forEach((id, i) => {
    const angle = startAngle + i * angleStep;
    const x = centerX + radius * Math.cos(angle) - 70;
    const y = centerY + radius * Math.sin(angle) - 25;

    nodes.push({
      id,
      type: 'agent',
      position: { x, y },
      data: {
        label: AGENT_LABELS[id] || id,
        description: AGENT_DESCRIPTIONS[id] || '',
        agentId: id,
        activations: activations[id] || 0,
      },
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    });
  });

  // Build edges from flow data
  const edges: Edge[] = [];
  const edgeMap = new Map<string, number>(); // dedup key → max value

  for (const link of links) {
    const key = `${link.source}-${link.target}`;
    const existing = edgeMap.get(key) || 0;
    edgeMap.set(key, Math.max(existing, link.value));
  }

  edgeMap.forEach((value, key) => {
    const [source, target] = key.split('-');
    const color = AGENT_COLORS[source] || '#888';
    const strokeWidth = Math.max(1.5, Math.min(5, value / 3));
    const isReturn = target === 'triage' && source !== 'triage';

    edges.push({
      id: key,
      source,
      target,
      type: 'smoothstep',
      animated: value > 5, // Animate high-traffic routes
      style: {
        stroke: color,
        strokeWidth,
        opacity: isReturn ? 0.4 : 0.8,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 16,
        height: 16,
      },
      label: `${value}×`,
      labelStyle: {
        fill: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: '#0a0e1a',
        fillOpacity: 0.8,
      },
    });
  });

  // If no flow data, add placeholder edges from triage to all specialists
  if (edges.length === 0) {
    specialists.forEach((id) => {
      edges.push({
        id: `triage-${id}`,
        source: 'triage',
        target: id,
        type: 'smoothstep',
        style: { stroke: AGENT_COLORS.triage, strokeWidth: 1.5, opacity: 0.3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: AGENT_COLORS.triage, width: 14, height: 14 },
      });
      edges.push({
        id: `${id}-triage`,
        source: id,
        target: 'triage',
        type: 'smoothstep',
        style: { stroke: AGENT_COLORS[id], strokeWidth: 1, opacity: 0.2, strokeDasharray: '5 5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: AGENT_COLORS[id], width: 12, height: 12 },
      });
    });
  }

  return { nodes, edges };
}

export function AgentFlowGraph({ links = [], className = '' }: AgentFlowGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(links),
    [links]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 overflow-hidden ${className}`}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-white font-medium">Agent Handoff Graph</h3>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {links.length > 0 ? `${links.length} routes active` : 'No flow data yet'}
        </span>
      </div>
      <div className="h-[480px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background color="rgba(255,255,255,0.03)" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-white/5 !border-white/10 !shadow-none [&>button]:!bg-white/5 [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/10"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
