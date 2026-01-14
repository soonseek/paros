/**
 * Linkage Visualization Component (Story 5.4)
 *
 * 자금 흐름 그래프 시각화 컴포넌트
 *
 * 기능:
 * - React Flow를 사용한 그래프 렌더링
 * - 노드 클릭 시 상세 정보 표시
 * - 줌/팬 기능
 * - 레이아웃 알고리즘 (트리, 원형, 히어라키)
 * - 체인 유형 필터링
 *
 * @component
 */

import React, { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import ChainFilterSidebar, {
  type ChainType,
} from "./chain-filter-sidebar";

// Types
export type LayoutType = "tree" | "circular" | "hierarchical";

// Chain data for filtering
export interface ChainData {
  id: string;
  chainType: ChainType;
}

interface LinkageVisualizationProps {
  nodes: Node[];
  edges: Edge[];
  chainsData?: ChainData[]; // 체인 데이터 (필터링용)
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 트리 레이아웃 적용 (dagre 라이브러리)
 *
 * @param nodes - 노드 배열
 * @param edges - 엣지 배열
 * @returns 레이아웃이 적용된 노드 배열
 */
function applyTreeLayout(nodes: Node[], edges: Edge[]): Node[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB" }); // Top to Bottom

  // 노드 추가
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  // 엣지 추가
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 레이아웃 계산
  dagre.layout(dagreGraph);

  // 위치 적용
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });
}

/**
 * 원형 레이아웃 적용
 *
 * @param nodes - 노드 배열
 * @returns 레이아웃이 적용된 노드 배열
 */
function applyCircularLayout(nodes: Node[]): Node[] {
  const radius = Math.min(nodes.length * 50, 500);
  const centerX = 500;
  const centerY = 500;

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });
}

/**
 * 히어라키 레이아웃 적용
 *
 * @param nodes - 노드 배열
 * @param edges - 엣지 배열
 * @returns 레이아웃이 적용된 노드 배열
 */
function applyHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
): Node[] {
  // BFS로 깊이 계산
  const depthMap = new Map<string, number>();
  const visited = new Set<string>();

  // 시작 노드 찾기 (엣지의 source가 아닌 노드)
  const allTargets = new Set(edges.map((e) => e.target.toString()));
  const startNodeId = nodes.find((n) => !allTargets.has(n.id))?.id;

  if (!startNodeId) {
    // 순환 그래프 또는 엣지가 없는 경우
    console.warn(
      "[LinkageVisualization] applyHierarchicalLayout: 시작 노드 미발견, 폴백 레이아웃 적용"
    );
    return nodes.map((node, index) => ({
      ...node,
      position: { x: index * 250, y: 0 },
    }));
  }

  const queue = [{ id: startNodeId, depth: 0 }];
  depthMap.set(startNodeId, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const children = edges
      .filter((e) => e.source === id)
      .map((e) => e.target.toString());

    children.forEach((childId) => {
      if (!depthMap.has(childId)) {
        depthMap.set(childId, depth + 1);
        queue.push({ id: childId, depth: depth + 1 });
      }
    });
  }

  // 깊이별 위치 계산
  const nodesByDepth = new Map<number, Node[]>();
  nodes.forEach((node) => {
    const depth = depthMap.get(node.id) ?? 0;
    if (!nodesByDepth.has(depth)) nodesByDepth.set(depth, []);
    nodesByDepth.get(depth)!.push(node);
  });

  return nodes.map((node) => {
    const depth = depthMap.get(node.id) ?? 0;
    const nodesAtDepth = nodesByDepth.get(depth) ?? [];
    const index = nodesAtDepth.indexOf(node);
    const spacing = 300;

    return {
      ...node,
      position: {
        x: index * spacing + 100,
        y: depth * 200 + 100,
      },
    };
  });
}

/**
 * 레이아웃 알고리즘 적용
 *
 * @param nodes - 노드 배열
 * @param edges - 엣지 배열
 * @param layoutType - 레이아웃 유형
 * @returns 레이아웃이 적용된 노드 배열
 */
function applyLayout(
  nodes: Node[],
  edges: Edge[],
  layoutType: LayoutType
): Node[] {
  switch (layoutType) {
    case "tree":
      return applyTreeLayout(nodes, edges);
    case "circular":
      return applyCircularLayout(nodes);
    case "hierarchical":
      return applyHierarchicalLayout(nodes, edges);
    default:
      return nodes;
  }
}

/**
 * LinkageVisualization 컴포넌트
 */
export default function LinkageVisualization({
  nodes: initialNodes,
  edges: initialEdges,
  chainsData,
  onNodeClick,
}: LinkageVisualizationProps) {
  const [layoutType, setLayoutType] = useState<LayoutType>("tree");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedChainTypes, setSelectedChainTypes] = useState<ChainType[]>([]);

  // 필터링된 노드 계산
  const filteredNodes = useMemo(() => {
    if (selectedChainTypes.length === 0) {
      return initialNodes; // 전체 선택
    }

    return initialNodes.filter((node) => {
      const chain = chainsData?.find((c) => c.id === node.id);
      return chain && selectedChainTypes.includes(chain.chainType);
    });
  }, [initialNodes, selectedChainTypes, chainsData]);

  // 필터링된 엣지 계산 (필터링된 노드에 연결된 엣지만 표시)
  const filteredEdges = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    return initialEdges.filter(
      (edge) =>
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
  }, [initialEdges, filteredNodes]);

  // 레이아웃이 적용된 노드 계산 (필터링된 노드 사용)
  const layoutedNodes = useMemo(
    () =>
      applyLayout(filteredNodes, filteredEdges, layoutType).map((node) => ({
        ...node,
        data: {
          ...node.data,
          originalBackground: node.style?.background,
        },
        // React Flow 애니메이션 활성화
        animated: true,
      })),
    [filteredNodes, filteredEdges, layoutType]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges);

  // 레이아웃이 변경되면 노드 위치 업데이트 (필터링된 노드 사용)
  React.useEffect(() => {
    const updatedNodes = applyLayout(
      filteredNodes,
      filteredEdges,
      layoutType
    ).map((node) => ({
      ...node,
      data: {
        ...node.data,
        originalBackground: node.style?.background,
      },
      // React Flow 애니메이션 활성화
      animated: true,
    }));
    setNodes(updatedNodes);
  }, [layoutType, filteredNodes, filteredEdges, setNodes]);

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);

      // 연결된 노드 하이라이트 (BFS)
      const connectedNodeIds = new Set<string>();
      const queue = [node.id];
      connectedNodeIds.add(node.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;

        // 인접 노드 찾기
        edges.forEach((edge) => {
          if (edge.source === currentId && !connectedNodeIds.has(edge.target)) {
            connectedNodeIds.add(edge.target);
            queue.push(edge.target);
          }
          if (edge.target === currentId && !connectedNodeIds.has(edge.source)) {
            connectedNodeIds.add(edge.source);
            queue.push(edge.source);
          }
        });
      }

      // 노드 스타일 업데이트 (하이라이트)
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === node.id) {
            // 클릭된 노드: 노란색 하이라이트
            return {
              ...n,
              style: {
                ...n.style,
                background: "#fef08a",
              },
            };
          } else if (connectedNodeIds.has(n.id)) {
            // 연결된 노드: 옅은 하이라이트
            return {
              ...n,
              style: {
                ...n.style,
                border: "3px solid #fbbf24",
              },
            };
          } else {
            // 연결되지 않은 노드: 기본 스타일 (투명도 감소)
            return {
              ...n,
              style: {
                ...n.style,
                opacity: 0.3,
              },
            };
          }
        })
      );

      // 콜백 호출
      onNodeClick?.(node.id);
    },
    [edges, setNodes, onNodeClick]
  );

  // 선택 해제
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setNodes((prevNodes) =>
      prevNodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          background: (n.data as any).originalBackground || n.style?.background,
          opacity: 1,
          border: "2px solid #000",
        },
      }))
    );
  }, [setNodes]);

  // 커스텀 노드 컴포넌트
  const nodeTypes = useMemo(() => ({}), []);

  return (
    <div className="w-full h-full">
      {/* 레이아웃 선택기 */}
      <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-md">
        <label className="block text-sm font-medium mb-2">레이아웃</label>
        <select
          value={layoutType}
          onChange={(e) => setLayoutType(e.target.value as LayoutType)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="tree">트리 (Tree)</option>
          <option value="circular">원형 (Circular)</option>
          <option value="hierarchical">히어라키 (Hierarchical)</option>
        </select>
      </div>

      {/* 체인 필터 사이드바 */}
      {chainsData && chainsData.length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-white p-4 rounded-lg shadow-md max-w-xs">
          <ChainFilterSidebar
            selectedTypes={selectedChainTypes}
            onSelectionChange={setSelectedChainTypes}
          />
        </div>
      )}

      {/* React Flow 캔버스 */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const style = node.style as Record<string, string>;
            return style?.background || "#e0f2fe";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
