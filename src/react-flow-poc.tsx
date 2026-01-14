/**
 * React Flow PoC - 자금 흐름 시각화 기술 검증
 *
 * Epic 5 준비 작업
 *
 * 목적:
 * - React Flow 라이브러리 기능 검증
 * - 그래프 렌더링 성능 테스트 (목표: 100개 노드 < 1초)
 * - Node/Edge 스타일링 실험
 * - 줌/팬 상호작용 테스트
 *
 * @component
 */

import React, { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/**
 * 더미 트랜잭션 데이터 (10개)
 * 실제 애플리케이션에서는 서버에서 가져온 데이터를 사용
 */
const dummyTransactions = [
  { id: "1", memo: "김주택 입금", amount: 100000000, date: "2024-01-01", type: "DEPOSIT" },
  { id: "2", memo: "이은행 출금", amount: 50000000, date: "2024-01-02", type: "WITHDRAWAL" },
  { id: "3", memo: "박신탁 이체", amount: 30000000, date: "2024-01-03", type: "TRANSFER" },
  { id: "4", memo: "정저축 입금", amount: 20000000, date: "2024-01-04", type: "DEPOSIT" },
  { id: "5", memo: "채권자A 이체", amount: 15000000, date: "2024-01-05", type: "TRANSFER" },
  { id: "6", memo: "대출이자 납부", amount: 5000000, date: "2024-01-06", type: "WITHDRAWAL" },
  { id: "7", memo: "법률비용 지급", amount: 3000000, date: "2024-01-07", type: "WITHDRAWAL" },
  { id: "8", memo: "감정평가비", amount: 2000000, date: "2024-01-08", type: "WITHDRAWAL" },
  { id: "9", memo: "등록면허세", amount: 1000000, date: "2024-01-09", type: "WITHDRAWAL" },
  { id: "10", memo: "기타 비용", amount: 500000, date: "2024-01-10", type: "WITHDRAWAL" },
];

/**
 * 초기 노드 생성
 * 트랜잭션을 노드로 변환하고 계층 구조로 배치
 */
function createInitialNodes(): Node[] {
  return dummyTransactions.map((tx, index) => {
    const level = Math.floor(index / 3); // 3개씩 레벨 구분
    const positionInLevel = index % 3;

    return {
      id: tx.id,
      type: "default",
      position: {
        x: positionInLevel * 300,
        y: level * 200,
      },
      data: {
        label: (
          <div style={{ padding: "10px", minWidth: "200px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>{tx.memo}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {tx.amount.toLocaleString()}원
            </div>
            <div style={{ fontSize: "11px", color: "#999" }}>{tx.date}</div>
          </div>
        ),
      },
      style: {
        background: tx.type === "DEPOSIT" ? "#dcfce7" : tx.type === "WITHDRAWAL" ? "#fee2e2" : "#e0f2fe",
        border: "2px solid #000",
        borderRadius: "8px",
        width: 220,
      },
    };
  });
}

/**
 * 초기 엣지 생성
 * 트랜잭션 간 연결 관계 정의 (더미 데이터)
 */
function createInitialEdges(): Edge[] {
  return [
    { id: "e1-2", source: "1", target: "2", label: "자금 이동", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e1-3", source: "1", target: "3", label: "이체", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e1-4", source: "1", target: "4", label: "분기", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e2-5", source: "2", target: "5", label: "지급", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e2-6", source: "2", target: "6", label: "이자", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e3-7", source: "3", target: "7", label: "비용", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e3-8", source: "3", target: "8", label: "평가비", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e4-9", source: "4", target: "9", label: "세금", markerEnd: { type: MarkerType.ArrowClosed } },
    { id: "e4-10", source: "4", target: "10", label: "기타", markerEnd: { type: MarkerType.ArrowClosed } },
  ];
}

/**
 * React Flow PoC 컴포넌트
 */
export default function ReactFlowPoC() {
  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(createInitialEdges());

  /**
   * 새로운 연결 생성 (드래그 앤 드롭)
   */
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  /**
   * 노드 색상 변경 (더블클릭)
   */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const newNodes = nodes.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            style: {
              ...n.style,
              background: "#fef08a", // 노란색으로 하이라이트
            },
          };
        }
        return n;
      });
      setNodes(newNodes);
    },
    [nodes, setNodes]
  );

  /**
   * 성능 메트릭
   */
  const performanceMetrics = useMemo(() => ({
    nodeCount: nodes.length,
    edgeCount: edges.length,
    renderTime: performance.now(),
  }), [nodes.length, edges.length]);

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 헤더 */}
      <div style={{ padding: "20px", borderBottom: "1px solid #ddd", background: "#f9fafb" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
          React Flow PoC - 자금 흐름 시각화
        </h1>
        <p style={{ margin: "10px 0 0 0", color: "#666", fontSize: "14px" }}>
          Epic 5 준비 작업: React Flow 라이브러리 기능 검증
        </p>
        <div style={{ marginTop: "15px", display: "flex", gap: "20px", fontSize: "13px" }}>
          <div><strong>노드 수:</strong> {performanceMetrics.nodeCount}</div>
          <div><strong>엣지 수:</strong> {performanceMetrics.edgeCount}</div>
          <div><strong>상태:</strong> ✅ 정상 작동</div>
        </div>
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#888" }}>
          💡 조작법: 줌(마우스 휠), 팬(드래그), 노드 이동(노드 드래그), 연결(핀 드래그), 하이라이트(노드 더블클릭)
        </div>
      </div>

      {/* React Flow 캔버스 */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          attributionPosition="bottom-left"
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

      {/* 범례 */}
      <div style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        background: "white",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        fontSize: "12px",
      }}>
        <div style={{ fontWeight: "bold", marginBottom: "10px" }}>범례</div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
          <div style={{ width: "20px", height: "20px", background: "#dcfce7", border: "1px solid #000", marginRight: "8px" }}></div>
          <span>입금</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
          <div style={{ width: "20px", height: "20px", background: "#fee2e2", border: "1px solid #000", marginRight: "8px" }}></div>
          <span>출금</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: "20px", height: "20px", background: "#e0f2fe", border: "1px solid #000", marginRight: "8px" }}></div>
          <span>이체</span>
        </div>
      </div>
    </div>
  );
}
