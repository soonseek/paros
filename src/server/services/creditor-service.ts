/**
 * Creditor Service
 *
 * Story 6.4: 채권자별 필터링
 *
 * 채권자명 추출 및 필터링 기능 제공:
 * - Finding에서 고유 채권자명 추출
 * - 채권자명 JSON 파싱
 * - 채권자명 정규화 (향후 Task 5)
 */

import { PrismaClient } from "@prisma/client";

/**
 * Story 6.4: relatedCreditorNames JSON 파싱
 *
 * relatedCreditorNames 필드는 JSON 배열 형식의 문자열:
 * 예: '["채권자A", "채권자B"]'
 *
 * @param creditorNames - JSON 배열 문자열 또는 null
 * @returns 파싱된 채권자명 배열 (파싱 실패 시 빈 배열)
 */
export function parseCreditorNames(creditorNames: string | null): string[] {
  if (!creditorNames || creditorNames.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(creditorNames);

    // 배열이고 모든 요소가 문자열인지 검증
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed;
    }

    // 유효하지 않은 형식인 경우 빈 배열 반환
    return [];
  } catch (error) {
    // JSON 파싱 실패 시 빈 배열 반환
    console.error("Failed to parse creditorNames JSON:", error);
    return [];
  }
}

/**
 * Story 6.4 Task 1: 사건의 고유 채권자명 추출
 *
 * 사건 내 모든 Finding의 relatedCreditorNames를 수집하고,
 * 중복을 제거한 고유 채권자명 목록을 반환합니다.
 *
 * @param db - Prisma Client
 * @param caseId - 사건 ID
 * @returns 알파벳순 정렬된 고유 채권자명 배열
 */
export async function extractUniqueCreditors(params: {
  db: PrismaClient;
  caseId: string;
}): Promise<string[]> {
  const { db, caseId } = params;

  // 사건의 모든 Finding 조회 (relatedCreditorNames가 있는 것만)
  const findings = await db.finding.findMany({
    where: {
      caseId,
      relatedCreditorNames: {
        not: null,
      },
    },
    select: {
      relatedCreditorNames: true,
    },
  });

  // 모든 채권자명 수집
  const allCreditors = new Set<string>();

  for (const finding of findings) {
    const creditors = parseCreditorNames(finding.relatedCreditorNames);
    for (const creditor of creditors) {
      // 빈 문자열 제외
      const trimmed = creditor.trim();
      if (trimmed) {
        allCreditors.add(trimmed);
      }
    }
  }

  // 알파벳순 정렬 (한글도 정렬됨, 대소문자 구분 없음 - Task 7.6)
  return Array.from(allCreditors).sort((a, b) =>
    a.localeCompare(b, "ko", { sensitivity: "base" })
  );
}

/**
 * Story 6.4 Task 5: 채권자명 정규화
 *
 * 채권자명의 불일치를 방지하기 위해 텍스트 정규화를 수행합니다.
 * 향후 Finding 생성 시 적용 예정.
 *
 * 정규화 규칙:
 * - 앞뒤 공백 제거
 * - 연속 공백을 단일 공백으로 축약
 * - 특수 문자 제거 (선택적)
 *
 * @param creditorName - 원본 채권자명
 * @returns 정규화된 채권자명
 */
export function normalizeCreditorName(creditorName: string): string {
  return (
    creditorName
      .trim()
      // 연속 공백을 단일 공백으로 축약
      .replace(/\s+/g, " ")
      // 대소문자 정규화 (영문의 경우)
      .toLowerCase()
  );
}
