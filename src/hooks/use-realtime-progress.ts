/**
 * useRealtimeProgress Hook
 *
 * Story 3.5: 실시간 진행률 표시 (SSE)
 *
 * Custom hook for consuming Server-Sent Events (SSE) from the progress endpoint.
 * Manages EventSource connection, progress state, and lifecycle.
 *
 * Features:
 * - Automatic EventSource connection and cleanup
 * - Real-time progress updates (0-100%)
 * - Stage messages in Korean
 * - Error handling and reconnection
 * - Callbacks for completion and errors
 *
 * @example
 * const { progress, stage, error, isConnected } = useRealtimeProgress(caseId, documentId, {
 *   onComplete: () => toast.success('완료!'),
 *   onError: (error) => toast.error(error),
 * });
 */

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Progress event data structure from SSE
 */
interface ProgressEvent {
  progress: number; // 0-100
  status: string; // pending, analyzing, processing, saving, completed, failed
  stage: string; // Korean stage message
  timestamp: string; // ISO timestamp
  error?: string; // Error message if failed
}

/**
 * Options for useRealtimeProgress hook
 */
interface UseRealtimeProgressOptions {
  /** Callback when progress reaches 100% (completed) */
  onComplete?: () => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

/**
 * Return value for useRealtimeProgress hook
 */
interface UseRealtimeProgressReturn {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current status (pending, analyzing, processing, saving, completed, failed) */
  status: string;
  /** Current stage message in Korean */
  stage: string;
  /** Error message if an error occurred */
  error: string | null;
  /** Whether SSE connection is active */
  isConnected: boolean;
  /** Manually reconnect to SSE */
  reconnect: () => void;
  /** Manually disconnect from SSE */
  disconnect: () => void;
}

/**
 * Custom hook for real-time file upload progress via SSE
 *
 * @param caseId - Case ID
 * @param documentId - Document ID to track progress
 * @param options - Optional callbacks for completion and errors
 * @returns Progress state and control functions
 */
export function useRealtimeProgress(
  caseId: string,
  documentId: string,
  options: UseRealtimeProgressOptions = {}
): UseRealtimeProgressReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("pending");
  const [stage, setStage] = useState<string>("대기 중");
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);

  // Update options ref to avoid stale closures
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build SSE URL with query parameters
    const url = `/api/analyze/${caseId}/progress?documentId=${documentId}`;
    const eventSource = new EventSource(url);

    // Connection opened
    eventSource.onopen = () => {
      console.log("[SSE] Connected to progress endpoint");
      setIsConnected(true);
      setError(null);
    };

    // Message received
    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ProgressEvent;

        // Handle error message
        if (data.error) {
          setError(data.error);
          setIsConnected(false);
          optionsRef.current.onError?.(data.error);
          eventSource.close();
          return;
        }

        // Update progress state
        setProgress(data.progress);
        setStatus(data.status);
        setStage(data.stage);

        // Check if completed
        if (data.status === "completed") {
          setIsConnected(false);
          eventSource.close();
          optionsRef.current.onComplete?.();
        }
      } catch (err) {
        console.error("[SSE] Parse error:", err);
        setError("진행률 데이터 파싱 오류");
      }
    };

    // Connection error
    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      setIsConnected(false);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;
  }, [caseId, documentId]);

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log("[SSE] Disconnecting from progress endpoint");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Auto-connect on mount and disconnect on unmount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    progress,
    status,
    stage,
    error,
    isConnected,
    reconnect: connect,
    disconnect,
  };
}
