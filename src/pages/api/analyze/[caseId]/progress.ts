/**
 * SSE Endpoint for Real-time File Upload Progress
 *
 * Story 3.5: 실시간 진행률 표시 (SSE)
 *
 * This endpoint provides Server-Sent Events (SSE) for streaming file upload progress.
 * Clients can connect to receive real-time updates on file analysis progress.
 *
 * Authentication: Requires valid JWT access token
 * Authorization: User must be Case lawyer or Admin
 *
 * Query Parameters:
 * - caseId: Case ID (for RBAC check)
 * - documentId: Document ID to track progress
 *
 * Response Format (SSE):
 * - data: {"progress": 0-100, "status": "pending|analyzing|processing|saving|completed|failed",
 *          "stage": "Korean stage message", "timestamp": "ISO timestamp"}
 *
 * Error Response:
 * - data: {"error": "Error message", "progress": 0}
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAccessToken } from "~/lib/jwt";
import { db } from "~/server/db";
import { canAccessCase } from "~/lib/rbac";

/**
 * Main SSE handler for file upload progress
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only GET requests allowed
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Extract query parameters
    const { caseId } = req.query;
    const documentId = req.query.documentId as string;

    // Validate query parameters
    if (!caseId || typeof caseId !== "string") {
      res.status(400).json({ error: "Invalid caseId" });
      return;
    }

    if (!documentId || typeof documentId !== "string") {
      res.status(400).json({ error: "Invalid documentId" });
      return;
    }

    // Extract and verify Access Token from Authorization header or Cookie
    let accessToken: string | undefined;

    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader) {
      accessToken = authHeader.replace("Bearer ", "");
    } else if (req.headers.cookie) {
      // Fallback to cookie (EventSource doesn't support custom headers)
      // Simple cookie parsing without external library
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      accessToken = cookies.accessToken;
    }

    if (!accessToken) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    let userId: string;
    try {
      const decoded = verifyAccessToken(accessToken);
      userId = decoded.userId;
    } catch (error) {
      console.error("[SSE] Token verification failed:", error);
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    // RBAC: Check if user has access to the case
    const hasAccess = await canAccessCase(userId, caseId);
    if (!hasAccess) {
      res.status(403).json({ error: "이 사건에 접근할 권한이 없습니다" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Prevent Nginx buffering

    console.log(`[SSE] Connection established for document: ${documentId}`);

    // Start polling FileAnalysisResult status
    void sendProgressUpdates(req, res, caseId, documentId, userId);
  } catch (error) {
    console.error("[SSE] Initialization error:", error);
    res.status(500).json({ error: "SSE 연결 오류가 발생했습니다" });
  }
}

/**
 * Poll FileAnalysisResult status and send SSE updates
 *
 * @param req - NextApiRequest
 * @param res - NextApiResponse
 * @param caseId - Case ID
 * @param documentId - Document ID to track
 * @param userId - User ID (for logging)
 */
async function sendProgressUpdates(
  req: NextApiRequest,
  res: NextApiResponse,
  caseId: string,
  documentId: string,
  _userId: string
): Promise<void> {
  let isConnectionClosed = false;

  // Check if connection is closed
  const isClosed = () => isConnectionClosed || res.writableEnded;

  // Send initial progress
  sendSSEMessage(res, {
    progress: 0,
    status: "pending",
    stage: "파일 처리를 시작합니다...",
    timestamp: new Date().toISOString(),
  });

  // Poll FileAnalysisResult status
  const pollInterval = setInterval(async () => {
    if (isClosed()) {
      clearInterval(pollInterval);
      console.log(`[SSE] Connection closed for document: ${documentId}`);
      return;
    }

    try {
      // Query FileAnalysisResult status
      const analysis = await db.fileAnalysisResult.findUnique({
        where: { documentId },
        select: {
          status: true,
          errorMessage: true,
          analyzedAt: true,
        },
      });

      // If analysis not found, it might be in "pending" state (not yet created)
      if (!analysis) {
        // Keep showing pending status
        sendSSEMessage(res, {
          progress: 0,
          status: "pending",
          stage: "파일 처리를 시작합니다...",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Calculate progress based on status
      const progress = calculateProgress(analysis.status);
      const stage = getStageMessage(analysis.status);

      // Send progress update
      sendSSEMessage(res, {
        progress,
        status: analysis.status,
        stage,
        timestamp: new Date().toISOString(),
      });

      // Check if analysis is completed or failed
      if (analysis.status === "completed") {
        clearInterval(pollInterval);
        res.end(); // Close SSE connection
        console.log(`[SSE] Analysis completed for document: ${documentId}`);
      } else if (analysis.status === "failed") {
        clearInterval(pollInterval);
        // Send error message before closing
        sendSSEMessage(res, {
          error: analysis.errorMessage ?? "파일 분석에 실패했습니다",
          progress: 0,
        });
        res.end(); // Close SSE connection
        console.log(`[SSE] Analysis failed for document: ${documentId}`);
      }
    } catch (error) {
      clearInterval(pollInterval);
      console.error("[SSE] Error polling FileAnalysisResult:", error);
      // Send error message
      sendSSEMessage(res, {
        error: "진행률 확인 중 오류가 발생했습니다",
        progress: 0,
      });
      res.end(); // Close SSE connection
    }
  }, 1000); // Poll every 1 second (NFR-001: 1초 이내 업데이트)

  // Handle client disconnect
  req.on("close", () => {
    isConnectionClosed = true;
    clearInterval(pollInterval);
    console.log(`[SSE] Client disconnected for document: ${documentId}`);
  });
}

/**
 * Send SSE message to client
 *
 * @param res - NextApiResponse
 * @param data - Message data to send
 */
function sendSSEMessage(
  res: NextApiResponse,
  data: Record<string, unknown>
): void {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error("[SSE] Error sending message:", error);
  }
}

/**
 * Calculate progress percentage based on status
 *
 * Story 3.5: 진행률 퍼센트 계산
 *
 * @param status - FileAnalysisResult status
 * @returns Progress percentage (0-100)
 */
function calculateProgress(status: string): number {
  const progressMap: Record<string, number> = {
    pending: 0,
    analyzing: 50, // 구조 분석 중 (Story 3.4)
    processing: 75, // 데이터 추출 중 (Story 3.6)
    saving: 90, // DB 저장 중
    completed: 100,
    failed: 0,
  };
  return progressMap[status] ?? 0;
}

/**
 * Get Korean stage message based on status
 *
 * Story 3.5: 스테이지 메시지 변환
 *
 * @param status - FileAnalysisResult status
 * @returns Korean stage message
 */
function getStageMessage(status: string): string {
  const stageMap: Record<string, string> = {
    pending: "파일 처리를 시작합니다...",
    analyzing: "구조 분석 중...",
    processing: "데이터 추출 중...",
    saving: "데이터 저장 중...",
    completed: "완료",
    failed: "실패",
  };
  return stageMap[status] ?? "처리 중...";
}
