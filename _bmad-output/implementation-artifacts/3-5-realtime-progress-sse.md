# Story 3.5: 실시간 진행률 표시 (SSE)

**Status:** ready-for-dev
**Epic:** Epic 3 - 거래내역서 업로드 및 전처리
**Story Key:** 3-5-realtime-progress-sse
**Created:** 2026-01-09
**Dependencies:** Story 3.1 완료 (파일 업로드 UI), Story 3.3 완료 (S3 파일 저장), Story 3.4 완료 (파일 구조 분석)

---

## Story

**As a** 사용자,
**I want** 대용량 파일 처리 중 진행률을 실시간으로 확인해서,
**So that** 얼마나 기다려야 하는지 알 수 있다.

---

## Acceptance Criteria

### AC1: 진행률 바 초기 표시

**Given** 사용자가 대용량 파일을 업로드했을 때
**When** 파일 처리가 시작되면
**Then** ProgressBar 컴포넌트가 표시되고 진행률 0%부터 시작한다
**And** "파일 처리를 시작합니다..." 메시지가 표시된다

### AC2: 실시간 진행률 업데이트

**Given** 파일 처리가 진행 중일 때
**When** 서버가 SSE 이벤트를 전송하면
**Then** useRealtimeProgress 훅을 통해 진행률이 실시간으로 업데이트된다
**And** 진행률 퍼센트(0-100%)와 현재 단계가 표시된다:
  - "파일 업로드 중..." (0-20%)
  - "구조 분석 중..." (20-40%)
  - "데이터 추출 중..." (40-80%)
  - "데이터 저장 중..." (80-95%)
  - "완료" (100%)

### AC3: 처리 완료 표시

**Given** 파일 처리가 완료되었을 때
**When** 100% 진행률에 도달하면
**Then** "파일 업로드가 완료되었습니다" 메시지가 표시된다
**And** 진행률 바는 사라지고 처리된 파일 요약이 표시된다:
  - 파일명
  - 총 거래 건수
  - 식별된 열 (날짜, 입금액, 출금액 등)

### AC4: 오류 처리

**Given** 파일 처리 중에 오류가 발생했을 때
**When** 오류가 발생하면
**Then** ProgressBar에 오류 메시지가 표시된다
**And** SSE 연결은 종료된다
**And** 오류 메시지: "파일 처리 중 오류가 발생했습니다: {error_message}"
**And** "재시도" 버튼이 표시된다

### AC5: 페이지 새로고침 동작

**Given** 사용자가 페이지를 새로고침했을 때
**When** 진행 중이던 업로드가 있으면
**Then** 진행률 표시는 초기화되지만 백그라운드 처리는 계속 진행된다
**And** 사용자는 tRPC query로 처리 상태를 확인할 수 있다

**Requirements:** FR-019, UX Design (ProgressBar, SSE, useRealtimeProgress), Architecture (SSE), NFR-001 (진행률 업데이트 1초 이내)

---

## Developer Context & Guardrails

### 🎯 CRITICAL IMPLEMENTATION REQUIREMENTS

**🚨 THIS IS THE MOST IMPORTANT SECTION - READ CAREFULLY!**

### Technical Stack & Versions

- **Framework:** Next.js 14+ (Pages Router) - 프로젝트는 Pages Router 사용
- **Language:** TypeScript (strict mode)
- **Real-time:** Server-Sent Events (SSE) - WebSockets 아님!
- **State Management:** TanStack Query v5 (React Query) for server state
- **UI Components:** shadcn/ui (Radix UI) - Progress component 사용
- **Database:** PostgreSQL with Prisma ORM 7.2.0+
- **API Layer:** tRPC v11 (mutations) + Next.js Route Handlers (SSE)

### Architecture Compliance

**1. SSE 엔드포인트 구조**

**파일 위치:** `src/pages/api/analyze/[caseId]/progress.ts` (Pages Router)

SSE는 단방향 통신입니다: 서버 → 클라이언트만 가능합니다.

**Next.js Route Handler for SSE:**

```typescript
// src/pages/api/analyze/[caseId]/progress.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 방지

  const { caseId } = req.query;
  const documentId = req.query.documentId as string;

  // FileAnalysisResult 모델에서 상태 모니터링
  const sendProgress = async () => {
    try {
      // 분석 상태 확인
      const analysis = await db.fileAnalysisResult.findUnique({
        where: { documentId },
      });

      if (!analysis) {
        res.write(`data: ${JSON.stringify({ error: 'Analysis not found' })}\n\n`);
        res.end();
        return;
      }

      // 진행률 계산 및 전송
      const progress = calculateProgress(analysis.status);
      const message = {
        progress,
        status: analysis.status,
        stage: getStageMessage(analysis.status),
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(message)}\n\n`);

      // 완료 또는 실패 시 연결 종료
      if (analysis.status === 'completed' || analysis.status === 'failed') {
        if (analysis.status === 'failed') {
          res.write(`data: ${JSON.stringify({
            error: analysis.errorMessage,
            progress: 0
          })}\n\n`);
        }
        res.end();
      } else {
        // 1초 후 다시 확인 (NFR-001: 1초 이내 업데이트)
        setTimeout(sendProgress, 1000);
      }
    } catch (error) {
      console.error('[SSE Error]', error);
      res.write(`data: ${JSON.stringify({
        error: '진행률 확인 중 오류가 발생했습니다',
        progress: 0
      })}\n\n`);
      res.end();
    }
  };

  sendProgress();

  // 클라이언트 연결 해제 시 처리
  req.on('close', () => {
    console.log('[SSE] Client disconnected');
  });
}

function calculateProgress(status: string): number {
  const progressMap: Record<string, number> = {
    pending: 0,
    analyzing: 50, // 구조 분석 중
    processing: 75, // 데이터 추출 중
    saving: 90, // DB 저장 중
    completed: 100,
    failed: 0,
  };
  return progressMap[status] || 0;
}

function getStageMessage(status: string): string {
  const stageMap: Record<string, string> = {
    pending: '파일 처리를 시작합니다...',
    analyzing: '구조 분석 중...',
    processing: '데이터 추출 중...',
    saving: '데이터 저장 중...',
    completed: '완료',
    failed: '실패',
  };
  return stageMap[status] || '처리 중...';
}
```

**2. useRealtimeProgress Custom Hook**

**파일 위치:** `src/hooks/use-realtime-progress.ts`

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';

interface ProgressEvent {
  progress: number;
  status: string;
  stage: string;
  timestamp: string;
  error?: string;
}

interface UseRealtimeProgressOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useRealtimeProgress(
  caseId: string,
  documentId: string,
  options: UseRealtimeProgressOptions = {}
) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('pending');
  const [stage, setStage] = useState<string>('대기 중');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/analyze/${caseId}/progress?documentId=${documentId}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('[SSE] Connected');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);

        if (data.error) {
          setError(data.error);
          options.onError?.(data.error);
          eventSource.close();
          return;
        }

        setProgress(data.progress);
        setStatus(data.status);
        setStage(data.stage);

        if (data.status === 'completed') {
          eventSource.close();
          options.onComplete?.();
        }
      } catch (err) {
        console.error('[SSE] Parse error', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error', err);
      setIsConnected(false);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;
  }, [caseId, documentId, options]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

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
```

**3. ProgressBar Component**

**파일 위치:** `src/components/atoms/ProgressBar.tsx`

shadcn/ui Progress 컴포넌트를 사용하거나 커스텀 구현:

```typescript
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface ProgressBarProps {
  progress: number; // 0-100
  stage: string;
  error?: string | null;
}

export function ProgressBar({ progress, stage, error }: ProgressBarProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600 font-medium">❌ {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{stage}</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
```

**4. FileAnalyzerResult Model 상태 전이**

Story 3.4에서 이미 정의된 FileAnalysisResult 모델의 status 필드를 활용:

```prisma
model FileAnalysisResult {
  status          String   // pending, analyzing, completed, failed
  // ...
}
```

**상태 전이 로직:**
1. `pending` → 파일 업로드 완료, 분석 대기 중 (0%)
2. `analyzing` → 파일 구조 분석 중 (20-40%)
3. `processing` → 데이터 추출 중 (40-80%) - Story 3.6
4. `saving` → DB 저장 중 (80-95%)
5. `completed` → 완료 (100%)
6. `failed` → 실패 (0%, 에러 메시지 표시)

**5. File Upload Flow Integration**

Story 3.1 (uploadFile mutation)과 Story 3.4 (analyzeFile mutation)을 통합:

```typescript
// 사용자 컴포넌트에서
const uploadFile = api.file.uploadFile.useMutation();
const analyzeFile = api.file.analyzeFile.useMutation();

const { progress, stage, error } = useRealtimeProgress(caseId, documentId, {
  onComplete: () => {
    toast.success('파일 업로드가 완료되었습니다');
    // 파일 요약 표시
  },
  onError: (error) => {
    toast.error(error);
  },
});

const handleFileUpload = async (file: File) => {
  try {
    // 1. 파일 업로드 (Story 3.1)
    const uploadResult = await uploadFile.mutateAsync({
      caseId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileBuffer: arrayBufferToBase64(await file.arrayBuffer()),
    });

    const documentId = uploadResult.document.id;

    // 2. 파일 분석 시작 (Story 3.4)
    await analyzeFile.mutateAsync({ documentId });

    // 3. SSE 연결 시작
    // useRealtimeProgress가 자동으로 연결
  } catch (error) {
    console.error('File upload failed', error);
  }
};
```

### File Structure Requirements

**새로 생성할 파일:**

1. **SSE Route Handler**
   - `src/pages/api/analyze/[caseId]/progress.ts`
   - SSE 엔드포인트 구현
   - FileAnalysisResult 상태 모니터링
   - 진행률 계산 및 전송

2. **Custom Hook**
   - `src/hooks/use-realtime-progress.ts`
   - EventSource 관리
   - 진행률 상태 관리
   - 자동 재연결 로직

3. **ProgressBar Atom**
   - `src/components/atoms/ProgressBar.tsx`
   - shadcn/ui Progress 활용
   - 에러 상태 표시

**수정할 파일:**

1. **File Upload Component** (Story 3.1)
   - `src/components/organisms/FileUploader.tsx`
   - useRealtimeProgress 훅 통합
   - ProgressBar 표시 로직 추가

2. **analyzeFile Router** (Story 3.4)
   - `src/server/api/routers/file.ts`
   - status 업데이트 로직에 진행률 단계 추가
   - 분석 시작 시 `pending` → `analyzing`

### Testing Requirements

**Unit Tests:**

1. **SSE Route Handler**
   - `src/pages/api/analyze/[caseId]/progress.test.ts`
   - 올바른 SSE 헤더 설정 확인
   - 진행률 계산 로직 테스트
   - 에러 시 연결 종료 확인

2. **useRealtimeProgress Hook**
   - `src/hooks/use-realtime-progress.test.ts`
   - EventSource 연결/해제 테스트
   - 진행률 업데이트 수신 테스트
   - 에러 처리 테스트
   - 재연결 로직 테스트

3. **ProgressBar Component**
   - `src/components/atoms/ProgressBar.test.tsx`
   - 진행률 표시 렌더링
   - 에러 상태 표시
   - 스테이지 메시지 표시

**Integration Tests:**

1. **End-to-End File Upload Flow**
   - 파일 업로드 → analyzeFile 호출 → SSE 연결 → 진행률 업데이트 → 완료
   - 에러 발생 시 SSE 종료 및 에러 메시지 표시

2. **Page Refresh Scenario**
   - 처리 중 페이지 새로고침 → 진행률 초기화 → 백그라운드 계속 확인

### Previous Story Intelligence (Story 3.4)

**Story 3.4: 파일 구조 분석 및 열 식별**

**중요한 패턴과 결정:**

1. **FileAnalysisResult Model**
   - `status` 필드: pending, analyzing, completed, failed
   - `columnMapping`: JSON 필드로 열 매핑 저장
   - `confidence`: 0.0 ~ 1.0 신뢰도 점수

2. **analyzeFile tRPC Procedure**
   - `src/server/api/routers/file.ts:553-712`
   - RBAC 검증: Case lawyer 또는 Admin만 접근 가능
   - 기존 분석 확인: `existingAnalysis?.status === "completed"`
   - S3 다운로드 → 구조 분석 → DB 업데이트 순서

3. **S3 Download Function**
   - `src/lib/s3.ts:141-170`
   - Stream → Buffer 변환
   - 에러 핸들링: Korean error messages

4. **Code Patterns Established**
   - RBAC: `user?.role !== "ADMIN"`
   - Error handling: `TRPCError` with Korean messages
   - Json field: `errorDetails as Prisma.InputJsonValue`
   - Optional chain: `existingAnalysis?.status`

**Story 3.5에 적용:**

- FileAnalysisResult의 status를 진행률 계산에 활용
- analyzeFile mutation 호출 후 SSE 연결 시작
- RBAC 검증은 SSE 엔드포인트에서도 필요 (protected API)
- 에러 메시지 형식: Story 3.4와 동일하게 Korean messages

### Implementation Checklist

**Backend (API Layer):**
- [ ] SSE Route Handler 생성 (`src/pages/api/analyze/[caseId]/progress.ts`)
  - [ ] SSE 헤더 설정 (Content-Type, Cache-Control, Connection)
  - [ ] FileAnalysisResult 상태 폴링 (1초 간격)
  - [ ] 진행률 계산 함수 (status → 0-100)
  - [ ] 스테이지 메시지 함수 (status → Korean message)
  - [ ] 에러 시 SSE 종료 및 에러 메시지 전송
  - [ ] 연결 해제 핸들러 (req.on('close'))

**Frontend (UI Layer):**
- [ ] useRealtimeProgress Custom Hook (`src/hooks/use-realtime-progress.ts`)
  - [ ] EventSource 생성 및 관리
  - [ ] 진행률 상태 관리 (progress, status, stage, error)
  - [ ] 메시지 파싱 (JSON.parse)
  - [ ] 완료/실패 콜백
  - [ ] 자동 정리 (useEffect cleanup)
  - [ ] 재연결 함수

- [ ] ProgressBar Atom (`src/components/atoms/ProgressBar.tsx`)
  - [ ] shadcn/ui Progress 컴포넌트 사용
  - [ ] 진행률 퍼센트 표시 (0-100%)
  - [ ] 스테이지 메시지 표시
  - [ ] 에러 상태 표시 (red border)
  - [ ] 완료 시 자동 숨김 (optional)

- [ ] FileUploader Integration (`src/components/organisms/FileUploader.tsx`)
  - [ ] useRealtimeProgress 훅 통합
  - [ ] 파일 업로드 후 analyzeFile 호출
  - [ ] ProgressBar 표시
  - [ ] 완료 시 파일 요약 표시
  - [ ] 에러 시 재시도 버튼

**Testing:**
- [ ] SSE Route Handler 단위 테스트
- [ ] useRealtimeProgress 훅 단위 테스트
- [ ] ProgressBar 컴포넌트 테스트
- [ ] E2E 파일 업로드 플로우 테스트

### Critical Gotchas & Common Mistakes

**❌ WRONG:**
- WebSockets 사용 (양방향 통신 불필요)
- SSE 엔드포인트에서 인증/권한 검증 누락
- 진행률 업데이트 간격 너무 김 (>1초)
- EventSource 정리 안 함 (메모리 누수)
- 페이지 새로고침 후 SSE 재연결 불가

**✅ CORRECT:**
- SSE 사용 (단방향 통신)
- SSE 엔드포인트에서 RBAC 검증
- 1초 간격 폴링 (NFR-001 준수)
- useEffect cleanup으로 EventSource.close()
- 페이지 새로고침 시 tRPC query로 상태 확인 가능

### Performance Considerations

- **SSE 연결 수:** 동시에 최대 20명 (MVP) × 1 connection/user = 20 connections
- **폴링 간격:** 1초 (NFR-001: 1초 이내 업데이트)
- **DB 쿼리:** FileAnalysisResult.findUnique (인덱스 활용: documentId)
- **메모리:** EventSource 정리로 누수 방지

### Security Considerations

1. **SSE 엔드포인트 인증**
   - 세션/토큰 검증 필요
   - Case에 대한 접근 권한 확인 (RBAC)
   - documentId가 현재 사용자의 것인지 확인

2. **데이터 노출 방지**
   - 다른 사용자의 진행률 노출 방지
   - Case ID 검증

### References

- **Architecture:** `_bmad-output/planning-artifacts/architecture.md#실시간-진행률-sse`
- **Epic Definition:** `_bmad-output/planning-artifacts/epics.md#story-35`
- **Story 3.4:** `_bmad-output/implementation-artifacts/3-4-file-structure-analysis-column-identification.md`
- **Story 3.3:** `_bmad-output/implementation-artifacts/3-3-s3-file-storage-metadata.md`

---

## 🔍 Code Review Findings

**Review Date:** 2026-01-09
**Review Method:** BMAD Adversarial Code Review
**Reviewer:** Senior Developer Agent
**Status:** ⚠️ **ACTION REQUIRED** - 8 issues found (2 CRITICAL, 3 MEDIUM, 3 LOW)

### **🚨 CRITICAL Issues**

#### **CRITICAL-1: AccessToken 전달 불가 - EventSource API 제한으로 인한 보안 취약**

**Location:** [src/hooks/use-realtime-progress.ts#L108](src/hooks/use-realtime-progress.ts#L108)

**Severity:** CRITICAL
**AC Impact:** AC5 (페이지 새로고침 동작) - 인증 우회 가능

**Problem:**
```typescript
// EventSource 생성 - Authorization header 설정 불가
const url = `/api/analyze/${caseId}/progress?documentId=${documentId}`;
const eventSource = new EventSource(url);

// ❌ EventSource API는 HTTP headers를 custom할 수 없음
// ❌ Authorization header 추가 불가
// ❌ 로그인하지 않은 사용자도 SSE 접근 가능
```

**Vulnerability Analysis:**
- **인증 우회:** EventSource는 Authorization header를 전달할 수 없음
- **RBAC 우회:** 모든 Case의 진행률 정보 노출 가능
- **데이터 유출:** 비인가 사용자가 다른 사용자의 파일 분석 진행률 접근 가능

**Attack Scenario:**
```javascript
// 로그인 안 한 공격자가 직접 SSE 연결
const eventSource = new EventSource('/api/analyze/victim-case-id/progress?documentId=victim-doc-id');

eventSource.onmessage = (e) => {
  console.log(JSON.parse(e.data)); // 피해자 파일 분석 진행률 노출!
};
```

**Recommended Fix:**
```typescript
// ✅ URL Query Parameter에 access token 추가
const getAccessToken = (): string => {
  // 로컬 스토리지 또는 쿠키에서 가져오기
  return localStorage.getItem('accessToken') ?? 
         document.cookie.split('; ').find(row => row.startsWith('accessToken='))?.split('=')[1] ?? 
         '';
};

const connect = useCallback(() => {
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    setError('인증이 필요합니다');
    optionsRef.current.onError?.('인증이 필요합니다');
    return;
  }

  // Token을 URL에 포함
  const url = `/api/analyze/${caseId}/progress?documentId=${documentId}&token=${encodeURIComponent(accessToken)}`;
  const eventSource = new EventSource(url);

  // ... 나머지 로직
}, [caseId, documentId]);

// Backend에서 token 검증
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { caseId, documentId, token } = req.query;
  
  // ✅ Token에서 인증 정보 추출
  let userId: string;
  try {
    const decoded = verifyAccessToken(token as string);
    userId = decoded.userId;
  } catch {
    res.write(`data: ${JSON.stringify({ error: '인증이 필요합니다' })}\n\n`);
    res.end();
    return;
  }

  // ✅ RBAC 검증 계속...
  const hasAccess = await canAccessCase(userId, caseId as string);
  if (!hasAccess) {
    res.write(`data: ${JSON.stringify({ error: '이 사건에 접근할 권한이 없습니다' })}\n\n`);
    res.end();
    return;
  }

  // SSE 처리 계속...
}
```

---

#### **CRITICAL-2: SSE 무한 폴링으로 인한 메모리 누수 및 DB 과부하**

**Location:** [src/pages/api/analyze/[caseId]/progress.ts#L129](src/pages/api/analyze/[caseId]/progress.ts#L129)

**Severity:** CRITICAL
**AC Impact:** NFR-001 (진행률 업데이트 1초 이내) - 성능 저하

**Problem:**
```typescript
const pollInterval = setInterval(async () => {
  if (isClosed()) {
    clearInterval(pollInterval);
    console.log(`[SSE] Connection closed for document: ${documentId}`);
    return;
  }

  try {
    // DB 폴링...
    const analysis = await db.fileAnalysisResult.findUnique({
      where: { documentId },
      select: { status: true, errorMessage: true, analyzedAt: true },
    });
    // ...
  } catch (error) {
    clearInterval(pollInterval); // ✅ 에러 시 정리
  }
}, 1000); // ❌ 매 요청마다 1초 간격 폴링 (시스템 부하!)
```

**Vulnerability:**
- **DB 과부하:** 100명 동시 사용자 = 100개의 setInterval × DB 쿼리/초
- **메모리 누수:** 폴링 콜백이 closure로 메모리 유지
- **서버 마비:** 대량의 DB 쿼리로 PostgreSQL 연결 풀 고갈

**Performance Impact:**
```
예시: 100명 동시 업로드
- 폴링 간격: 1초
- 초당 DB 쿼리: 100개/초
- 분당 DB 쿼리: 6,000개/분
- 10분 업로드: 60,000개 쿼리

→ DB 연결 풀 고갈, 다른 요청 블로킹
```

**Recommended Fix:**
```typescript
// ✅ 1. 폴링 간격 조정 (2초로 증가, NFR-001 여전히 만족)
}, 2000);

// ✅ 2. 폴링 타임아웃 설정
const POLLING_TIMEOUT = 30 * 60 * 1000; // 30분
const startTime = Date.now();

const pollInterval = setInterval(async () => {
  if (Date.now() - startTime > POLLING_TIMEOUT) {
    clearInterval(pollInterval);
    res.write(`data: ${JSON.stringify({ error: '연결 타임아웃' })}\n\n`);
    res.end();
    console.log(`[SSE] Connection timeout for document: ${documentId}`);
    return;
  }

  if (isClosed()) {
    clearInterval(pollInterval);
    return;
  }

  // 폴링 로직...
}, 2000);

// ✅ 3. 동시 연결 수 제한
let activeStreams = 0;
const MAX_CONCURRENT_STREAMS = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (activeStreams >= MAX_CONCURRENT_STREAMS) {
    res.status(503).json({ error: '시스템이 과부하 상태입니다. 잠시 후 다시 시도해주세요' });
    return;
  }

  activeStreams++;
  console.log(`[SSE] Active streams: ${activeStreams}`);

  req.on('close', () => {
    activeStreams--;
    console.log(`[SSE] Active streams: ${activeStreams}`);
  });

  // SSE 처리 계속...
}

// ✅ 4. DB 쿼리 최적화 (캐싱 고려)
const cacheMap = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 500; // 500ms 캐시

const getAnalysisStatus = async (documentId: string) => {
  const cached = cacheMap.get(documentId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await db.fileAnalysisResult.findUnique({
    where: { documentId },
    select: { status: true, errorMessage: true, analyzedAt: true },
  });

  cacheMap.set(documentId, { data, timestamp: Date.now() });
  return data;
};
```

---

### **⚠️ MEDIUM Issues**

#### **MEDIUM-1: 토큰 만료 후 자동 재연결 없음**

**Location:** [src/hooks/use-realtime-progress.ts#L160-L175](src/hooks/use-realtime-progress.ts#L160-L175)

**Severity:** MEDIUM
**AC Impact:** AC2 (실시간 진행률 업데이트) - 중단

**Problem:**
```typescript
eventSource.onerror = (err) => {
  console.error("[SSE] Connection error:", err);
  setIsConnected(false);
  eventSource.close();
  // ❌ 재연결 시도 없음
  // 토큰 만료 시 영구적 실패
};
```

**Impact:**
- **토큰 만료 시 SSE 중단:** 장시간 업로드 중 토큰 만료 (기본 15분) → SSE 연결 끊김
- **사용자 경험 저하:** 진행률 표시 중단, 수동 새로고침 필요

**Recommended Fix:**
```typescript
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1초

const connect = useCallback(() => {
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    setError('인증이 필요합니다');
    return;
  }

  const url = `/api/analyze/${caseId}/progress?documentId=${documentId}&token=${encodeURIComponent(accessToken)}`;
  const eventSource = new EventSource(url);

  eventSource.onerror = (err) => {
    console.error("[SSE] Connection error:", err);
    
    // ✅ 재연결 시도 (지수 백오프)
    const retryCount = retryCountRef.current ?? 0;
    if (retryCount < MAX_RETRIES) {
      retryCountRef.current = retryCount + 1;
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      
      console.log(`[SSE] Retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        connect(); // 재연결 시도
      }, delay);
    } else {
      setIsConnected(false);
      setError('SSE 연결 실패. 페이지를 새로고침해주세요.');
      eventSource.close();
    }
  };

  eventSourceRef.current = eventSource;
}, [caseId, documentId]);
```

---

#### **MEDIUM-2: 토큰 검증 실패 시 응답 형식 불일치**

**Location:** [src/pages/api/analyze/[caseId]/progress.ts#L59-L67](src/pages/api/analyze/[caseId]/progress.ts#L59-L67)

**Severity:** MEDIUM
**AC Impact:** AC1 (진행률 바 초기 표시) - 에러 처리 미흡

**Problem:**
```typescript
// 에러 시 JSON 응답
if (!accessToken) {
  res.status(401).json({ error: "인증이 필요합니다" }); // ✅ JSON
  return;
}

// 정상 시 SSE 응답
res.setHeader("Content-Type", "text/event-stream"); // ✅ SSE

// ❌ 클라이언트가 JSON vs SSE 형식 구분 어려움
// ❌ EventSource는 JSON을 자동 파싱하지 않음
```

**Recommended Fix:**
```typescript
// ✅ 모든 응답을 SSE 형식으로 통일
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache, no-transform");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");

if (!caseId || typeof caseId !== "string") {
  res.write(`data: ${JSON.stringify({ error: "Invalid caseId" })}\n\n`);
  res.end();
  return;
}

if (!documentId || typeof documentId !== "string") {
  res.write(`data: ${JSON.stringify({ error: "Invalid documentId" })}\n\n`);
  res.end();
  return;
}

if (!accessToken) {
  res.write(`data: ${JSON.stringify({ error: "인증이 필요합니다" })}\n\n`);
  res.end();
  return;
}

// ... RBAC 검증
if (!hasAccess) {
  res.write(`data: ${JSON.stringify({ error: "이 사건에 접근할 권한이 없습니다" })}\n\n`);
  res.end();
  return;
}

// 정상 처리 계속...
```

---

#### **MEDIUM-3: AC3 미완 - completionData 미전달**

**Location:** [src/components/upload-zone.tsx#L145-L160](src/components/upload-zone.tsx#L145-L160)

**Severity:** MEDIUM
**AC Impact:** AC3 (처리 완료 표시) - 요약 정보 미제공

**Problem:**
```typescript
{analyzingDocumentId && (
  <ProgressBar
    progress={progress}
    stage={stage}
    error={progressError}
    completionData={undefined} // ❌ 항상 undefined
  />
)}

// AC3 요구사항:
// - 파일명
// - 총 거래 건수
// - 식별된 열
// 모두 미구현
```

**Recommended Fix:**
```typescript
// ✅ 분석 결과 조회 (Story 3.4의 FileAnalysisResult)
const analysisQuery = api.file.getAnalysisResult.useQuery(
  { documentId: analyzingDocumentId ?? "" },
  { enabled: analyzingDocumentId !== null && progress === 100 }
);

{analyzingDocumentId && (
  <ProgressBar
    progress={progress}
    stage={stage}
    error={progressError}
    completionData={
      progress === 100 && analysisQuery.data
        ? {
            fileName: analysisQuery.data.document.originalFileName,
            totalTransactions: analysisQuery.data.transactionCount,
            columns: analysisQuery.data.identifiedColumns,
          }
        : undefined
    }
  />
)}
```

---

### **📝 LOW Issues**

#### **LOW-1: 에러 메시지 한국어 미비**

**Location:** [src/hooks/use-realtime-progress.ts#L147](src/hooks/use-realtime-progress.ts#L147)

**Problem:**
```typescript
eventSource.onerror = (err) => {
  console.error("[SSE] Connection error:", err);
  setIsConnected(false);
  eventSource.close();
  // ❌ 사용자 친화적 한국어 에러 메시지 없음
};
```

**Recommended Fix:**
```typescript
const getErrorMessage = (): string => {
  return 'SSE 연결에 실패했습니다. 페이지를 새로고침해주세요.';
};

eventSource.onerror = (err) => {
  console.error("[SSE] Connection error:", err);
  const errorMsg = getErrorMessage();
  setError(errorMsg);
  optionsRef.current.onError?.(errorMsg);
  setIsConnected(false);
  eventSource.close();
};
```

---

#### **LOW-2: AC4 미구현 - "재시도" 버튼 없음**

**Location:** [src/components/atoms/ProgressBar.tsx#L58-L66](src/components/atoms/ProgressBar.tsx#L58-L66)

**Problem:**
```typescript
if (error) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="pt-6">
        <p className="text-red-600 font-medium">❌ {error}</p>
        {/* ❌ AC4: "재시도" 버튼 없음 */}
      </CardContent>
    </Card>
  );
}
```

**Recommended Fix:**
```typescript
export interface ProgressBarProps {
  progress: number;
  stage: string;
  error?: string | null;
  completionData?: { fileName: string; totalTransactions?: number; columns?: string[] };
  onRetry?: () => void; // ✅ 재시도 콜백
}

export function ProgressBar({
  progress,
  stage,
  error,
  completionData,
  onRetry,
}: ProgressBarProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <p className="text-red-600 font-medium">❌ {error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
                재시도
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  // ...
}

// upload-zone.tsx에서 사용
<ProgressBar
  progress={progress}
  stage={stage}
  error={progressError}
  completionData={completionData}
  onRetry={() => {
    setAnalyzingDocumentId(null);
    // 재분석 시작
    analyzeFile();
  }}
/>
```

---

#### **LOW-3: AC5 미구현 - 페이지 새로고침 후 상태 미복구**

**Location:** [src/hooks/use-realtime-progress.ts](src/hooks/use-realtime-progress.ts)

**Problem:**
```typescript
// AC5 요구사항:
// "사용자가 페이지를 새로고침했을 때...사용자는 tRPC query로 처리 상태를 확인할 수 있다"
// 현재 useRealtimeProgress는 SSE만 사용
// 페이지 새로고침 시 진행률 초기화됨 (복구 불가)
```

**Recommended Fix:**
```typescript
export function useRealtimeProgress(
  caseId: string,
  documentId: string,
  options: UseRealtimeProgressOptions = {}
): UseRealtimeProgressReturn {
  // ✅ tRPC query로 현재 상태 조회
  const statusQuery = api.file.getAnalysisProgress.useQuery(
    { documentId },
    { enabled: !!documentId }
  );

  const [progress, setProgress] = useState(() => statusQuery.data?.progress ?? 0);
  const [status, setStatus] = useState<string>(() => statusQuery.data?.status ?? "pending");
  const [stage, setStage] = useState<string>(() => statusQuery.data?.stage ?? "대기 중");

  // Mount 시 기존 진행률 복원
  useEffect(() => {
    if (statusQuery.data) {
      setProgress(statusQuery.data.progress);
      setStatus(statusQuery.data.status);
      setStage(statusQuery.data.stage);
      
      // 이미 완료됐으면 SSE 연결 불필요
      if (statusQuery.data.status === "completed") {
        optionsRef.current.onComplete?.();
        return;
      }
      
      // 진행 중이면 SSE 연결
      connect();
    }
  }, [statusQuery.data, connect]);

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
```

---

## 📊 Review Summary

| 심각도 | Issue | AC Impact | 위치 |
|--------|-------|-----------|------|
| **CRITICAL-1** | AccessToken 전달 불가 (보안) | AC5 | [use-realtime-progress.ts#L108](src/hooks/use-realtime-progress.ts#L108) |
| **CRITICAL-2** | SSE 무한 폴링 (메모리/DB) | NFR-001 | [progress.ts#L129](src/pages/api/analyze/[caseId]/progress.ts#L129) |
| **MEDIUM-1** | 토큰 만료 후 재연결 불가 | AC2 | [use-realtime-progress.ts#L160](src/hooks/use-realtime-progress.ts#L160) |
| **MEDIUM-2** | 응답 형식 불일치 | AC1 | [progress.ts#L59](src/pages/api/analyze/[caseId]/progress.ts#L59) |
| **MEDIUM-3** | completionData 미전달 | AC3 | [upload-zone.tsx#L145](src/components/upload-zone.tsx#L145) |
| **LOW-1** | 에러 메시지 한국어 미비 | AC4 | [use-realtime-progress.ts#L147](src/hooks/use-realtime-progress.ts#L147) |
| **LOW-2** | "재시도" 버튼 미구현 | AC4 | [ProgressBar.tsx#L58](src/components/atoms/ProgressBar.tsx#L58) |
| **LOW-3** | 페이지 새로고침 후 상태 미복구 | AC5 | [use-realtime-progress.ts](src/hooks/use-realtime-progress.ts) |

**총 8개 Issue 발견 (2 CRITICAL, 3 MEDIUM, 3 LOW)**

---

## ✅ Action Items

### Priority 1 (CRITICAL - Must Fix Before Release)

- [ ] **ACTION-1:** [use-realtime-progress.ts#L108](src/hooks/use-realtime-progress.ts#L108) - AccessToken을 URL query parameter로 전달하도록 수정 (EventSource API 제한 우회)
- [ ] **ACTION-2:** [progress.ts#L129](src/pages/api/analyze/[caseId]/progress.ts#L129) - SSE 폴링 최적화 (2초 간격, 타임아웃, 동시 연결 제한, 캐싱)

### Priority 2 (MEDIUM - Should Fix Soon)

- [ ] **ACTION-3:** [use-realtime-progress.ts#L160](src/hooks/use-realtime-progress.ts#L160) - 자동 재연결 로직 추가 (지수 백오프, 최대 3회)
- [ ] **ACTION-4:** [progress.ts#L59](src/pages/api/analyze/[caseId]/progress.ts#L59) - 모든 응답을 SSE 형식으로 통일
- [ ] **ACTION-5:** [upload-zone.tsx#L145](src/components/upload-zone.tsx#L145) - completionData 전달 로직 구현 (tRPC query 통합)

### Priority 3 (LOW - Nice to Have)

- [ ] **ACTION-6:** [use-realtime-progress.ts#L147](src/hooks/use-realtime-progress.ts#L147) - 한국어 에러 메시지 추가
- [ ] **ACTION-7:** [ProgressBar.tsx#L58](src/components/atoms/ProgressBar.tsx#L58) - "재시도" 버튼 구현 (onRetry 콜백)
- [ ] **ACTION-8:** [use-realtime-progress.ts](src/hooks/use-realtime-progress.ts) - tRPC query 통합으로 페이지 새로고침 후 상태 복구

---

**Story Status 변경:** `ready-for-dev` → `in-progress` (CRITICAL 및 MEDIUM issues 수정 필요)

**다음 단계:**
1. CRITICAL issues 수정 (ACTION-1, ACTION-2)
2. MEDIUM issues 수정 (ACTION-3, ACTION-4, ACTION-5)
3. 전체 테스트 스위트 실행
4. 재심의 요청

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

- N/A (Story 생성 단계)

### Completion Notes List

- N/A (구현 전)

### File List

- **New Files:**
  - `src/pages/api/analyze/[caseId]/progress.ts` (SSE Route Handler)
  - `src/hooks/use-realtime-progress.ts` (Custom Hook)
  - `src/components/atoms/ProgressBar.tsx` (Progress Component)

- **Modified Files:**
  - `src/components/organisms/FileUploader.tsx` (SSE 통합)
  - `src/server/api/routers/file.ts` (진행률 상태 전이 로직)

- **Test Files:**
  - `src/pages/api/analyze/[caseId]/progress.test.ts`
  - `src/hooks/use-realtime-progress.test.ts`
  - `src/components/atoms/ProgressBar.test.tsx`
