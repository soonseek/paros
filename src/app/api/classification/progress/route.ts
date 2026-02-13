/**
 * AI Classification Progress SSE Endpoint
 *
 * Story 4.1, HIGH-3 FIX: 실시간 진행률 전송
 *
 * Server-Sent Events (SSE)를 사용하여 AI 분류 진행률을 실시간으로 전송합니다.
 *
 * GET /api/classification/progress?documentId=xxx
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
 */

import { NextRequest } from "next/server";
import { db } from "~/server/db";

/**
 * SSE 엔드포인트: AI 분류 진행률 실시간 스트리밍
 */
export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get("documentId");

  if (!documentId) {
    return new Response("documentId is required", { status: 400 });
  }

  // SSE 헤더 설정
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // 스트림 생성
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // 이벤트 전송 함수
      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        // FileAnalysisResult 조회
        const fileAnalysisResult = await db.fileAnalysisResult.findFirst({
          where: { documentId },
        });

        if (!fileAnalysisResult) {
          sendEvent({
            status: "pending",
            progress: 0,
            total: 0,
            error: "파일 분석 결과를 찾을 수 없습니다",
          });
          controller.close();
          return;
        }

        // 분류 작업 상태 추적
        let lastStatus = "";
        let lastProgress = -1;

        // 폴링 간격 (500ms)
        const pollInterval = setInterval(() => {
          void (async () => {
            try {
              const classificationJob = await db.classificationJob.findUnique(
                {
                  where: { fileAnalysisResultId: fileAnalysisResult.id },
                }
              );

            if (!classificationJob) {
              // 작업이 아직 생성되지 않음
              sendEvent({
                status: "pending",
                progress: 0,
                total: 0,
              });
              return;
            }

            // 상태 또는 진행률이 변경된 경우에만 이벤트 전송
            const statusChanged = classificationJob.status !== lastStatus;
            const progressChanged = classificationJob.progress !== lastProgress;

            if (statusChanged || progressChanged) {
              sendEvent({
                status: classificationJob.status,
                progress: classificationJob.progress,
                total: classificationJob.total,
                error: classificationJob.error,
              });

              lastStatus = classificationJob.status;
              lastProgress = classificationJob.progress;
            }

            // 완료 또는 실패 시 연결 종료
            if (
              classificationJob.status === "completed" ||
              classificationJob.status === "failed"
            ) {
              clearInterval(pollInterval);
              controller.close();
            }
          } catch (error) {
            console.error("[SSE] 폴링 에러:", error);
            clearInterval(pollInterval);
            sendEvent({
              status: "failed",
              progress: 0,
              total: 0,
              error: String(error),
            });
            controller.close();
          }
          })();
        }, 500);

        // 60초 타임아웃
        setTimeout(() => {
          clearInterval(pollInterval);
          controller.close();
        }, 60000);

        // 클라이언트 연결 해제 시 정리
        request.signal.addEventListener("abort", () => {
          clearInterval(pollInterval);
          controller.close();
        });
      } catch (error) {
        console.error("[SSE] 초기화 에러:", error);
        sendEvent({
          status: "failed",
          progress: 0,
          total: 0,
          error: String(error),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
