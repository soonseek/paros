/**
 * useClassificationProgress Hook
 *
 * Story 4.1, HIGH-3 FIX: 실시간 진행률 구독
 *
 * SSE를 사용하여 AI 분류 진행률을 실시간으로 수신합니다.
 *
 * @example
 * const { progress, status } = useClassificationProgress(documentId);
 */

import { useEffect, useState } from "react";

interface ClassificationProgress {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total: number;
  error?: string;
}

interface UseClassificationProgressOptions {
  onCompleted?: () => void;
  onFailed?: (error?: string) => void;
}

interface UseClassificationProgressResult {
  progress: ClassificationProgress | null;
  isConnected: boolean;
  error: string | null;
}

export function useClassificationProgress(
  documentId: string | null,
  options?: UseClassificationProgressOptions
): UseClassificationProgressResult {
  const [progress, setProgress] = useState<ClassificationProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    // SSE 연결
    const eventSource = new EventSource(
      `/api/classification/progress?documentId=${encodeURIComponent(documentId)}`
    );

    // 연결 열림
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    // 메시지 수신
    eventSource.onmessage = (event) => {
      try {
        const data: ClassificationProgress = JSON.parse(event.data);

        setProgress(data);

        // 완료 시 콜백 호출
        if (data.status === "completed") {
          options?.onCompleted?.();
          eventSource.close();
          setIsConnected(false);
        }

        // 실패 시 콜백 호출
        if (data.status === "failed") {
          options?.onFailed?.(data.error);
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error("[SSE] 메시지 파싱 에러:", err);
        setError("메시지 파싱 실패");
      }
    };

    // 에러 처리
    eventSource.onerror = (err) => {
      console.error("[SSE] 연결 에러:", err);
      setError("SSE 연결 실패");
      setIsConnected(false);
      eventSource.close();
    };

    // 클린업
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [documentId, options]);

  return {
    progress,
    isConnected,
    error,
  };
}
