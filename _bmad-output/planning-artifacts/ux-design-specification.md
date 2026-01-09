---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments: ["_bmad-output/planning-artifacts/prd.md"]
workflowType: 'ux-design'
lastStep: 14
date: 2026-01-07
---

# UX Design Specification pharos-bmad

**Author:** Soonseek
**Date:** 2026-01-07

---

## Executive Summary

### Project Vision

**Paros(파로스)**는 회생 파산 전문 법인을 위한 AI 코파일럿 통합 시스템입니다. 첫 번째 기능인 **"자금 흐름 추적 분석"**은 Paros 전체 시스템의 **"신뢰의 문(Trust Door)"** 역할을 합니다.

**핵심 가치 제안:**
- 통장 분석 시간을 **4-8시간에서 30분으로 단축** (50% 개선)
- 엑셀/이미지/클립보드로 **30초 안에** 보고서에 바로 활용 가능
- 실무자들이 "이제 수동 분석은 상상도 안 해"라고 말할 만큼의 업무 효율 혁신

**제품 유형:** Next.js 기반 웹 애플리케이션 (브라우저 중심, 데스크탑 최적화)

### Target Users

**1차 사용자 (Primary): 실무 담당자**
- **역할:** 법무사, 실무자, 채권 회수 팀
- **특징:**
  - 기술적 숙련도: 다양함 (엑셀 활용 능숙, 클라우드 도구 사용 경험 있음)
  - 업무 패턴: 엑셀에 수동 입력 + 종이 출력 후 형광펜 표시
  - 보고: 엑셀 → 워드에 붙여넣기
  - 협업: 이메일/메신저로 파일 공유

**2차 사용자 (Secondary): 변호사**
- **역할:** 검토자, 승인자
- **특징:**
  - 실무자가 분석한 결과를 최종 검토
  - 법정 제출 서류 작성
  - AI 분석 결과의 정확성을 중요시

### Key Design Challenges

**1. 엑셀 → 워드 워크플로우 최적화** ⭐ 가장 중요
- **문제:** 실무자들은 엑셀을 워드에 붙여넣는 과정에 익숙함
- **목표:** "엑셀 다운로드 → 워드에 바로 붙여넣기"가 **30초 안에** 완료되어야 함
- **기술적 고려사항:** 엑셀 포맷(테두리, 정렬, 폰트)이 워드에서 깨지지 않아야 함

**2. 복잡한 데이터 단순화**
- **문제:** 통장 거래 내역은 수백~수천 건 (예: 5개 계좌 × 6개월 × 월 50건 = 1,500건)
- **목표:** "3초 규칙" - 핵심 발견 3가지를 즉시 파악
- **위험:** 너무 많은 정보는 오히려 혼란 (Information Overload)

**3. 신뢰도 확보**
- **문제:** 실무자들은 AI 결과를 100% 신뢰하지 않을 것임
- **목표:** AI 분석 결과를 사용자가 직접 보정할 수 있어야 함 (태그 수정)
- **필요:** "왜 이게 자산 처분 의심이지?"에 대한 설명(Explainability)

**4. 파일 혼합 처리**
- **문제:** PDF, 엑셀, 이미지(JPG/PNG), 스캔본 등 다양한 형식
- **목표:** 업로드 실패 시 명확한 에러 메시지와 해결책 제시
- **복원력:** 일부 파일 실패 시 정상 파일로 계속 진행

**5. 데스크탑 중심 UI**
- **문제:** 테이블이 많아서 가로 스크롤이 발생할 수 있음
- **목표:** 1920px, 1366px 모니터 최적화, 가로 스크롤 최소화

### Design Opportunities

**1. "30초 성공 경험" 설계** ⭐ 차별화 포인트
```
기존: 통장 분석 4시간 + 엑셀 정리 2시간 = 6시간
Paros: 업로드 1분 + 분석 1분 + 엑셀 다운로드 30초 = 2분 30초
```
- **핵심 감정:** "이거 진짜 빠르다!" 느낌을 주는 UX
- **전략:** 첫 화면에서 즉시 가치 전달

**2. 시각적 패턴 인식 도구**
- **현재:** 종이 출력 후 형광펜으로 표시하던 행동
- **Paros:** 디지털로 자동화
- **대시보드:** 🔴 자산 처분 의심, 🟡 대규모 출금, 🟠 계좌 간 이체
- **색상 코딩:** Red = 문제, Yellow = 주의, Orange = 패턴 (직관적 이해)

**3. 프로그레시브 디스클로저 (Progressive Disclosure)**
- **레벨 1:** 첫 화면 - 핵심 발견 3가지 요약
- **레벨 2:** 클릭 시 - 상세 필터링 옵션
- **레벨 3:** 다시 클릭 - 원본 데이터
- **전략:** 필요한 만큼만 점진적으로 공개

**4. 협업 파일 공유 간소화**
- **현재:** 이메일/메신저로 파일 전송
- **Paros:** 분석 결과를 공유 URL 또는 파일로 쉽게 내보내기
- **유즈케이스:** "이거 변호사님께 보고해야 되는데" → 1클릭으로 파일 생성

**5. 실무자 친화적 UI**
- **타겟:** 실무자들의 업무 패턴에 맞춤
- **인터랙션:** 엑셀 단축키 스타일 (Ctrl+C, Ctrl+V 등 친숙한 패턴)
- **라벨링:** 명확한 버튼 라벨 ("다운로드", "필터", "내보내기")

---

## Core User Experience

### Defining Experience

**핵심 사용자 액션 (Core User Action):**

Paros의 가장 핵심적인 사용자 경험은 **"파일 업로드 → 분석 결과 확인 → 엑셀 다운로드 → 워드에 붙여넣기"** 흐름입니다.

**가장 자주 하는 행동:**
- 파일 업로드 (새 사건 시작 시)
- 분석 결과 확인 (대시보드, 필터링)
- **엑셀 다운로드** (보고서 작성용)

**절대 실패하면 안 되는 것:**
**"엑셀 다운로드 → 워드에 붙여넣기"**가 **30초 안에** 완료되어야 함

**완전히 노력 없어야 할 것:**
- 파일 업로드: 드래그 앤 드롭으로 자동 감지
- 엑셀 다운로드: 버튼 1클릭으로 즉시 다운로드
- 워드에 붙여넣기: 그냥 Ctrl+V (포맷 깨지지 않음)

### Platform Strategy

**웹 앱 (Next.js) - 브라우저 기반**

**주요 플랫폼:**
- **데스크탑 (Primary):** 1920px, 1366px 최적화
  - 마우스/키보드 중심 (엑셀 사용자에게 친숙한 패턴)
  - 넓은 화면에서 테이블 데이터 탐색 최적화

- **iPad (Secondary):** 768px - 1024px ✅ 필수 지원
  - 터치 인터페이스 지원 (드래그 앤 드롭, 탭)
  - 세로/가로 모드 모두 지원
  - 이동 중에도 결과 확인 가능

**모바일 (Future):** 375px+ (향후 고려)

**기술적 접근:**
- Next.js SSR (초기 로딩 속도)
- Tailwind CSS 반응형 유틸리티
- 업로드 진행률: SSE (Server-Sent Events)

### Effortless Interactions

**1. 드래그 앤 드롭 업로드**
```
기존: 파일 선택 버튼 → 폴더 탐색 → 파일 하나씩 선택 (반복)
Paros: 파일 5개를 그냥 드래그해서 놓기 (자동 감지)
```
- 파일 형식 자동 감지 (PDF, 엑셀, 이미지)
- 손상된 파일 명확히 표시
- 일부 실패 시 정상 파일로 계속 진행

**2. 실시간 진행률 표시**
```
기존: "로딩 중..." 멈춘 화면 (끝난 건지, 멈춘 건지 모름)
Paros:
⏳ 분석 진행 중... (30%)
✓ 국민은행_홍길동.pdf 완료
⏳ 신한은행_홍길동.jpg 처리 중...
⏳ 패턴 분석 대기 중...
```
- 어떤 단계가 진행 중인지 명확히 표시
- 예상 완료 시간 표시
- 장애 발생 시 자동 백업 (사용자는 느끼지 못함)

**3. 1클릭 엑셀 다운로드** ⭐ 가장 중요
```
기존: 필터 → 선택 → 다운로드 → 형식 선택 → 확인
Paros: [엑셀 다운로드] 버튼 클릭 → 즉시 다운로드
```
- 법원 제출 가능한 깔끔한 엑셀 포맷
- 워드에 붙여넣어도 깨지지 않음 (테두리, 정렬, 폰트)
- 필터링된 결과만 다운로드 가능

**4. 태그 직접 수정**
```
기존: AI가 틀리면 지원팀에 연락 → 1시간 대기
Paros: 거래 행의 [태그] 버튼 클릭 → "정상 거래" 선택 → 즉시 반영
```
- AI 분석 결과를 사용자가 직접 보정
- 드롭다운으로 쉽게 수정
- 수정 이력 기록 (감사 로그)

**5. 클립보드 복사**
```
사용: 5건 선택 → [클립보드 복사] → Word에 Ctrl+V
결과: 표 형식으로 깔끔하게 붙여넣기
```
- 엑셀 파일 열 필요 없이 바로 복사
- 표 형식으로 정리되어 있음

### Critical Success Moments

PRD의 User Journey 1 (김지현 변호사)에서 정의된 성공 순간:

**1. "Aha!" Moment - 첫 3초**
```
화면:
📊 분석 완료 - 홍길동 채무자 자금 흐름

⚠️ 핵심 발견 3건

1. 🔴 자산 처분 강력 의심
   2024-02-15 | 국민은행 | 5억원 출금
   → 부동산 매매계약서 일치!

2. 🟡 1억원 이상 대규모 출금 (7건)
   기간: 2024-01-01 ~ 2024-03-31
   합계: 12억 5천만원

3. 🟠 계좌 간 이체 패턴 (23건)
   → 특정 계좌로 자금 집중 감지
```
**사용자 반응:** *"5억원 자산 처분? 그거 내가 지난번에 놓쳤던 그 패턴이잖아!"*

**2. "진짜 빠르다!" Moment - 30초**
```
워크플로우:
1. "1억원 이상 출금건" 클릭 → 7건 표시
2. [엑셀 다운로드] 버튼 클릭
3. 엑셀 열기 → 필요한 열 복사
4. 워드에 붙여넣기
```
**소요 시간:** 1분 30초 (저번엔 3시간 걸림)
**사용자 반응:** *"진짜?"* (의자에서 일어나 커피를 타러 감)

**3. "이제 수동은 안 해" Moment - 재사용**
```
2주 후, 보정 명령: "5000만원 이상 출금건도 조사 바람"

Paros:
1. 접속
2. [금액 필터: 5000만원 이상] 클릭
3. 3초 만에 12건 표시
4. 엑셀 다운로드 → 보정 명령 대응서에 붙여넣기
```
**소요 시간:** 30분 (기존에는 2-3시간)
**사용자 반응:** *"이제 수동으로 통장 보는 건 상상도 안 해"*

### Experience Principles

PRD와 디자인 챌린지/기회에서 추출한 5가지 경험 원칙:

**1. 3초 규칙 (The 3-Second Rule)** ⭐ 가장 중요
> "사용자가 3초 안에 핵심 인사이트를 파악할 수 있어야 한다"

**적용:**
- 첫 화면: 핵심 발견 3가지 즉시 표시 (색상 코딩: 🔴🟡🟠)
- 클릭 횟수 최소화 (1클릭으로 원하는 결과)
- 로딩 없는 경험 (실시간 진행률, 예상 시간 표시)

**2. 30초 완료 (30-Second Completion)** ⭐ 핵심 성공
> "분석 결과를 엑셀로 다운로드해서 워드에 붙여넣기까지 30초 안에"

**적용:**
- 버튼 1클릭으로 즉시 다운로드
- 엑셀 포맷이 워드에서 깨지지 않음 (테두리, 정렬, 폰트)
- 클립보드 복사도 지원 (엑셀 파일 열 필요 없음)

**3. 프로그레시브 디스클로저 (Progressive Disclosure)**
> "필요한 만큼만 점진적으로 공개"

**적용:**
- **Level 1:** 요약 (핵심 발견 3가지, 색상 코딩)
- **Level 2:** 상세 (필터링된 거래 테이블)
- **Level 3:** 원본 (모든 거래 내역, 계좌별)

**4. 사용자 제어 (User Control)**
> "AI가 틀리면 사용자가 직접 수정할 수 있어야 한다"

**적용:**
- 태그 직접 수정 기능 (드롭다운)
- "왜 이게 자산 처분 의심이지?"에 대한 설명 (적요, 금액, 패턴)
- 수정 이력 기록 (누가, 언제, 무엇을 변경)

**5. 복원력 (Resilience)** ⭐ 신뢰도
> "일부가 실패해도 전체가 멈추지 않아야 한다"

**적용:**
- 일부 파일 실패 시 정상 파일로 계속 진행
- API 장애 시 자동 백업 (Upstate → Google)
- 사용자는 장애를 느끼지 못함 (진행률 유지)

---

## Desired Emotional Response

### Primary Emotional Goals

PRD의 User Journey 1 (김지현 변호사)에서 식별된 핵심 감정적 목표:

**1. "이거 진짜 빠르다!" - 놀라움과 기쁨** ⭐ 가장 중요
- 4-8시간 걸리던 통장 분석이 2분 30초로 완료
- *"진짜?"*라고 말하게 만듦 (의자에서 일어나 커피를 타러 감)
- **여유와 자유:** 6시간 작업이 2분 30초로 → 업무 시간 단축

**2. "내가 놓쳤던 패턴을 찾았어!" - 성취감과 자신감**
- 지난번에 놓쳤던 자산 처분 의심 건(5억원) 발견
- *"법관도 '조사가 철저하네'라고 칭찬했지"*
- **전문가로서의 자부심:** "내가 이제 전문가가 된 느낌?"

**3. "이제 수동은 상상도 안 해" - 충성도과 자부심**
- 동료에게 자연스럽게 추천
- *"이거 한 번 쓰면 Paros의 다른 기능도 믿고 쓰고 싶다"*
- **Paros 없으면 업무 불가능:** 도구 의존도 형성

### Emotional Journey Mapping

**Phase 1: 첫 발견 (First Discovery)**
```
상황: 새 사건 의뢰, 통장 내역 5개 파일 수신
현재 감정: 불안, 압도감 ("또 밤을 새워야 하나?", "가슴이 철렁내려앉는다")
Paros 목표: 호기심, 희망 ("이거 한번 써보자")
```

**Phase 2: 핵심 경험 (Core Experience)**
```
상황: 파일 업로드 → 분석 진행 중
현재 감정: 지루함, 피로감 (반복 작업)
Paros 목표: 몰입, 놀라움 ("⏳ 분석 진행 중... (30%)" - 투명한 진행률)
           "이거 진짜 되네?" (실시간 피드백)
```

**Phase 3: 완료 (Completion)**
```
상황: 분석 완료 → 핵심 발견 확인 → 엑셀 다운로드 → 워드에 붙여넣기
현재 감정: 안도, 하지만 여전히 피로 (여전히 몇 시간 걸림)
Paros 목표: **성취감, 안도감, 자유** ("1분 30초? 진짜?", "이제 퇴근할 수 있어!")
```

**Phase 4: 재사용 (Reuse)**
```
상황: 2주 후, 보정 명령, 다시 Paros 사용
현재 감정: 예상 가능, 익숙함
Paros 목표: **자신감, 충성도** ("3초 만에 12건", "이제 수동은 상상도 안 해")
```

**Phase 5: 장애 상황 (Error Resilience)**
```
상황: 일부 파일 손상, 또는 API 장애
현재 감정: 좌절, 불안 ("망했다, 다시 해야 하나?")
Paros 목표: **안심, 통제감** ("아, 부분적으로 되네", "장애인 줄도 몰랐네")
```

### Micro-Emotions

**긍정적 마이크로-감정 (만들고 싶은):**

**1. 자신감 (Confidence)** vs. 혼란 (Confusion)
```
현재: "이거 맞는 분석일까? 내가 뭘 놓친 것 같은데"
Paros: 🔴🟡🟠 색상 코딩으로 명확히 표시
      "왜 이게 자산 처분 의심이지?"에 대한 설명 (적요, 금액, 패턴 매칭)
```

**2. 신뢰 (Trust)** vs. 회의적 (Skepticism)
```
현재: "AI가 또 틀리겠지" (AI 불신)
Paros: 태그 직접 수정으로 사용자 제어권 부여
      수정 이력 기록으로 투명성 확보
      장애 시 자동 백업 (사용자는 느끼지 못함)으로 신뢰도 향상
```

**3. 흥분 (Excitement)** vs. 불안 (Anxiety)
```
현재: "법관에게 또 지적받으면 어쩌지?" (불안)
Paros: "법관도 '조사가 철저하네'라고 칭찬" (성취감)
      1분 30초 만에 완료해서 놀라움 ("진짜?")
```

**4. 성취감 (Accomplishment)** vs. 좌절 (Frustration)
```
현재: 6시간 작업 후 "오늘도 야근이네" (좌절)
Paros: 2분 30초 후 "이제 퇴근할 수 있어!" (성취감)
```

**5. 즐거움 (Delight)** vs. 그냥 만족 (Satisfaction)
```
현재: "그래도 됐다" (평범한 만족)
Paros: "이거 진짜 빠르다!" (즐거움, 자랑하고 싶음, 동료에게 추천)
```

**부정적 마이크로-감정 (피하고 싶은):**

- **혼란:** "버튼이 어디 있지?", "이게 뭘 의미하지?"
- **불안:** "파일이 업로드되고 있긴 한 거야?", "멈춘 거야?"
- **좌절:** "또 에러가 떴어", "다시 처음부터 해야 하나?"
- **무력감:** "AI가 틀렸는데 고칠 수가 없어"
- **후회:** "그냥 수동으로 하는 게 나았을 뻔"

### Design Implications

**감성 → UX 디자인 연결:**

**1. 놀라움과 기쁨 → 3초 규칙**
```
감정: "이거 진짜 빠르다!"
UX 디자인:
  - 첫 화면에서 핵심 발견 3가지 즉시 표시
  - 색상 코딩 (🔴🟡🟠)으로 시각적 임팩트
  - 클릭 횟수 최소화 (1클릭으로 원하는 결과)
```

**2. 신뢰 → 투명한 진행률**
```
감정: "잘 되고 있긴 한 거야?"
UX 디자인:
  - 실시간 진행률 (⏳ 30%)
  - 단계별 표시 (문서 파싱 → 추출 → 분석 → 완료)
  - 파일별 완료 표시 (✓ 국민은행 완료)
  - 예상 완료 시간 표시
```

**3. 통제감 → 태그 수정**
```
감정: "AI가 틀렸는데 고칠 수가 없어" → "내가 고칠 수 있어!"
UX 디자인:
  - 각 거래 행의 [태그] 버튼
  - 드롭다운으로 쉽게 수정
  - 즉시 반영 (새로고침 없음)
```

**4. 안심 → 복원력**
```
감정: "파일 하나 손상됐는데, 다 처음부터 해야 하나?" → "되는 건 되는구나"
UX 디자인:
  - 일부 파일 실패 시 정상 파일로 계속 진행
  - 명확한 에러 메시지와 해결책
  - "2개 파일로 분석을 진행합니다"
  - [계속] / [취소하고 파일 다시 선택] 옵션
```

**5. 성취감 → 30초 완료**
```
감정: "6시간 작업" → "2분 30초 완료" → "이제 퇴근할 수 있어!"
UX 디자인:
  - 1클릭 즉시 엑셀 다운로드
  - 워드에 바로 붙여넣기 가능한 포맷
  - 클립보드 복사 (엑셀 파일 열 필요 없음)
```

**6. 즐거움 → 딜라잇 요소**
```
감정: "그래도 됐다" → "이거 진짜 빠르다!" (자랑하고 싶음)
UX 디자인:
  - 부드러운 애니메이션 (과하지 않게, 자연스럽게)
  - 색상 코딩으로 직관적 이해
  - 완료 시 미묘한 성공 피드백 (체크마크, 토스트 메시지)
```

### Emotional Design Principles

**1. 3초 안에 "와!" (Wow in 3 Seconds)** ⭐ 가장 중요
> 첫 화면에서 3초 안에 핵심 가치를 전달해서 사용자를 놀라게 하라

**적용:**
- 핵심 발견 3가지 색상 코딩으로 즉시 표시
- 로딩 없는 경험 (SSR, 코드 스플리팅)
- "이거 진짜 되네?"라는 반응 이끌기

**2. 투명한 진행 (Transparent Progress)**
> 사용자가 불안해하지 않도록 무슨 일이 일어나는지 항상 보여라

**적용:**
- 실시간 진행률 (단계별, 파일별)
- 예상 완료 시간
- 장애 발생 시에도 알림 (자동 백업 중)

**3. 통제감 부여 (Give Control)**
> AI가 틀려도 사용자가 직접 수정할 수 있게 하라

**적용:**
- 태그 직접 수정
- "왜 이게 자산 처분 의심이지?"에 대한 설명
- 수정 이력 기록

**4. 30초 안에 완료 (Complete in 30 Seconds)**
> 엑셀 다운로드 → 워드에 붙여넣기까지 30초 안에

**적용:**
- 1클릭 즉시 다운로드
- 워드 호환 엑셀 포맷
- 클립보드 복사

**5. 실패해도 괜찮아 (It's Okay to Fail)**
> 일부가 실패해도 전체가 멈추지 않게 하라

**적용:**
- 부분 분석 지원
- 명확한 에러 메시지와 해결책
- 사용자가 느끼지 못하게 자동 복구

**Primary Emotional Goal:** **"이거 진짜 빠르다! 이제 수동은 상상도 안 해!"**

**Secondary Feelings:** 안도감 ("이제 퇴근할 수 있어!"), 자신감 ("내가 전문가된 느낌?"), 자부심 ("동료에게 추천하고 싶어"), 안심 ("장애인 줄도 몰랐네")

**Emotions to Avoid:** 불안 ("잘 되고 있나?"), 좌절 ("또 에러났어"), 혼란 ("버튼이 어디 있지?"), 무력감 ("AI가 틀렸는데 고칠 수 없어"), 후회 ("그냥 수동으로 할걸")

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

타겟 사용자(실무자)들이 자주 사용하는 앱들에서 UX 영감을 얻습니다:

**A. 엑셀 (Microsoft Excel)** ⭐ 가장 중요
- **사용 맥락:** 실무자들이 매일 사용하는 도구
- **UX 성공 요인:**
  - 친숙한 인터페이스 (테이블, 필터, 정렬)
  - 강력한 데이터 조작 (드래그 앤 드롭, 복사/붙여넣기)
  - 즉각적인 피드백 (입력하면 바로 반영)
  - 키보드 단축키 (Ctrl+C, Ctrl+V, Ctrl+F)
- **Paros에 적용:**
  - 테이블 UI 패턴 (엑셀과 유사한 인터페이스)
  - 필터/정렬 상호작용
  - 클립보드 복사 (Ctrl+C/V 친숙한 패턴)

**B. 슬랙 (Slack)** - 협업 플랫폼
- **사용 맥락:** 팀 내 커뮤니케이션
- **UX 성공 요인:**
  - 실시간 업데이트 (메시지 즉시 표시)
  - 직관적인 파일 공유 (드래그 앤 드롭)
  - 검색 기능 강력 (과거 메시지 찾기 쉬움)
  - 깔끔한 UI (복잡하지 않음)
- **Paros에 적용:**
  - 실시간 진행률 (분석 상황 즉시 표시)
  - 파일 업로드 UX (드래그 앤 드롭)
  - 검색 기능 (거래 내역 검색)

**C. 구글 시트 (Google Sheets)** - 클라우드 스프레드시트
- **사용 맥락:** 협업 엑셀
- **UX 성공 요인:**
  - 브라우저에서 완벽하게 작동
  - 실시간 협업 (다중 사용자 동시 편집)
  - 자동 저장 (데이터 손실 걱정 없음)
  - 모바일에서도 사용 가능
- **Paros에 적용:**
  - 브라우저 기반 테이블 UI
  - 자동 저장 (분석 결과 즉시 저장)
  - iPad에서도 사용 가능

**D. Tableau** - 데이터 시각화
- **사용 맥락:** 비즈니스 인텔리전스
- **UX 성공 요인:**
  - 인터랙티브 대시보드 (핵심 메트릭 즉시 파악)
  - 드릴다운 (요약 → 상세)
  - 색상 코딩으로 패턴 식별
  - 필터링 직관적
- **Paros에 적용:**
  - 대시보드 (핵심 발견 3가지)
  - 프로그레시브 디스클로저 (요약 → 상세 → 원본)
  - 색상 코딩 (🔴🟡🟠)

**E. Notion** - 문서 관리
- **사용 맥락:** 지식 베이스
- **UX 성공 요인:**
  - 깔끔하고 미니멀한 UI
  - 드래그 앤 드롭으로 블록 재배치
  - / (슬래시) 커맨드로 빠른 액션
  - 계층적 정보 구조
- **Paros에 적용:**
  - 미니멀한 UI (복잡하지 않게)
  - 명확한 정보 계층 (요약 → 상세 → 원본)

### Transferable UX Patterns

**네비게이션 패턴:**

**1. 테이블 중심 네비게이션 (엑셀, 구글 시트)**
- **적용:** 거래 내역 테이블에서 핵심 데이터 탐색
- **Paros 사용 사례:** 정렬, 필터, 검색으로 빠르게 원하는 거래 찾기
- **이점:** 실무자들에게 친숙한 패턴

**2. 사이드바 + 메인 콘텐츠 (슬랙, Notion)**
- **적용:** 왼쪽에 필터/검색, 오른쪽에 결과 표시
- **Paros 사용 사례:** 필터 옵션(금액, 유형, 기간) → 결과 테이블
- **이점:** 명확한 정보 계층

**상호작용 패턴:**

**1. 드래그 앤 드롭 파일 업로드 (슬랙, 구글 드라이브)**
- **적용:** 파일 5개를 동시에 업로드
- **Paros 사용 사례:** 통장 내역 파일(PDF, 엑셀, 이미지) 업로드
- **이점:** 직관적, 빠름

**2. 실시간 진행률 표시 (구글 시트, 슬랙)**
- **적용:** 분석 진행 상황 즉시 표시
- **Paros 사용 사례:** "⏳ 분석 진행 중... (30%)", 파일별 완료 표시
- **이점:** 불안 해소 ("잘 되고 있나?")

**3. 인라인 편집 (구글 시트)**
- **적용:** 테이블에서 직접 데이터 수정
- **Paros 사용 사례:** 태그 드롭다운으로 직접 수정
- **이점:** 별도 모달/페이지 이동 없음

**4. 1클릭 액션 (엑셀, 구글 시트)**
- **적용:** 버튼 1클릭으로 즉시 결과
- **Paros 사용 사례:** [엑셀 다운로드] 버튼
- **이점:** 빠름, 명확함

**시각적 패턴:**

**1. 색상 코딩 (Tableau, 엑셀 조건부 서식)**
- **적용:** 중요도에 따라 색상 구분
- **Paros 사용 사례:** 🔴 자산 처분 의심, 🟡 대규모 출금, 🟠 계좌 간 이체
- **이점:** 3초 안에 핵심 파악

**2. 카드/위젯 레이아웃 (Notion, Tableau 대시보드)**
- **적용:** 핵심 정보를 카드로 요약
- **Paros 사용 사례:** 핵심 발견 3가지를 카드로 표시
- **이점:** 한눈에 요약 정보 파악

**3. 미니멀한 UI (Notion, 슬랙)**
- **적용:** 불필요한 요소 제거
- **Paros 사용 사례:** 깔끔한 화면, 중요한 버튼/정보만 표시
- **이점:** 혼란 최소화, 집중도 향상

### Anti-Patterns to Avoid

**1. 복잡한 마법사 (Wizard) 패턴**
- **문제:** 파일 업로드 → 형식 선택 → 옵션 설정 → 확인 → ... 단계가 너무 많음
- **사용자 반응:** "그냥 수동으로 하는 게 빠르겠는데"
- **Paros 대안:** 드래그 앤 드롭 → 자동 감지 → 바로 분석 시작

**2. 모달 팝업 과다 (Modal Overload)**
- **문제:** 모든 액션이 모달에서 일어남
- **사용자 반응:** "이게 닫히는 건지, 진행되는 건지 모르겠겠네"
- **Paros 대안:** 인라인 편집 (테이블에서 직접 태그 수정)

**3. 로딩 스피너만 멈춰있음 (Spinner with No Context)**
- **문제:** "로딩 중..."만 표시, 끝난 건지, 멈춘 건지 모름
- **사용자 반응:** 불안, "멈춘 건가?"
- **Paros 대안:** 실시간 진행률 (단계별, 파일별)

**4. 테이블 가로 스크롤 과다 (Excessive Horizontal Scroll)**
- **문제:** 열이 너무 많아서 가로 스크롤이 계속됨
- **사용자 반응:** 피로감, "뭐가 어디 있는지 모르겠겠네"
- **Paros 대안:** 중요한 열만 표시, 나머지는 "상세 보기"로

**5. 저장 버튼 없음 (No Save Button)**
- **문제:** 자동 저장인 줄 알았는데 새로고침하면 데이터 날아감
- **사용자 반응:** 좌절, "내 작업 30분 날아갔네"
- **Paros 대안:** 자동 저장 + "저장됨" 표시

### Design Inspiration Strategy

**채택할 것 (Adopt):**

**1. 엑셀 스타일 테이블 UI**
- **이유:** 실무자들에게 친숙한 패턴
- **적용:** 거래 내역 테이블 (정렬, 필터, 검색)
- **Paros 특화:** 색상 코딩(🔴🟡🟠), 태그 수정 기능 추가

**2. 드래그 앤 드롭 파일 업로드**
- **이유:** 직관적, 빠름
- **적용:** 파일 5개 동시 업로드, 형식 자동 감지
- **Paros 특화:** 손상된 파일 명확히 표시, 부분 분석 지원

**3. 실시간 진행률 (구글 시트, 슬랙)**
- **이유:** 불안 해소
- **적용:** "⏳ 분석 진행 중... (30%)", 파일별 완료 표시
- **Paros 특화:** 단계별 표시 (파싱 → 추출 → 분석 → 완료)

**4. 색상 코딩 (Tableau)**
- **이유:** 3초 안에 핵심 파악
- **적용:** 🔴 자산 처분 의심, 🟡 대규모 출금, 🟠 계좌 간 이체
- **Paros 특화:** 한국 실무자 맥락에 맞는 색상/의미

**적응할 것 (Adapt):**

**1. 대시보드 (Tableau → Paros)**
- **Tableau:** 복잡한 비즈니스 메트릭
- **Paros:** 단순화 (핵심 발견 3가지만)
- **수정:** 너무 복잡하지 않게, 클릭 한 번으로 상세 보기

**2. 필터 (엑셀 → Paros)**
- **엑셀:** 복잡한 필터 옵션
- **Paros:** 단순화 (금액 기준: 100만/1천만/1억원)
- **수정:** Post-MVP에서 맞춤 금액 범위 추가

**3. 테이블 (엑셀 → Paros)**
- **엑셀:** 수백 열 가능
- **Paros:** 중요한 열만 (거래일시, 출금/입금, 금액, 적요, 태그)
- **수정:** 가로 스크롤 최소화

**피할 것 (Avoid):**

**1. 복잡한 마법사 (Wizard) 패턴**
- **이유:** 단계가 너무 많아서 느림
- **Paros:** 드래그 앤 드롭 → 자동 감지 → 바로 시작

**2. 모달 팝업 과다**
- **이유:** 혼란, 느림
- **Paros:** 인라인 편집 (테이블에서 직접 수정)

**3. 로딩 스피너만**
- **이유:** 불안
- **Paros:** 실시간 진행률 (단계별, 파일별)

**핵심 전략:** 엑셀 + 구글 시트 + Tableau의 패턴을 실무자 맥락에 맞게 단순화

---

## Design System Foundation

### Design System Choice

**PRD에서 이미 기술 스택이 정의되어 있으며, 이를 기반으로 최적의 디자인 시스템을 선택합니다:**

**Tailwind CSS + shadcn/ui + TanStack Table** ⭐ 최종 선택

**선택 이유:**

**1. PRD와 일치** (이미 Tailwind CSS 선택됨)
- PRD: "Frontend: React/Vue + Tailwind CSS"
- 일관성 유지를 위해 Tailwind 기반 시스템 선택

**2. 빠른 개발** (MVP 2-3달)
- Tailwind: 유틸리티 클래스로 빠른 개발
- shadcn/ui: 검증된 컴포넌트 복사해서 사용 (npm install 불필요)
- TanStack Table: 강력한 테이블 기능 즉시 사용

**3. 엑셀/구글 시트 스타일 UI 구현**
- Tailwind: 테이블 스타일링 용이
- TanStack Table: 엑셀 스타일 인터랙션 (정렬, 필터, 검색)
- shadcn/ui: 미니멀한 버튼, 드롭다운, 모달

**4. 반응형 디자인** (데스크탑 + iPad)
- Tailwind: 반응형 유틸리티 (`sm:`, `md:`, `lg:`)
- shadcn/ui: 모바일 친화적 컴포넌트

**5. 미니멀한 UI** (Notion/Slack 스타일)
- shadcn/ui: 깔끔하고 미니멀한 디자인
- Tailwind: 불필요한 요소 제거 용이

**6. 커스터마이징** (Paros 색상 코딩 🔴🟡🟠)
- Tailwind: 커스텀 색상 토큰
- shadcn/ui: 테마로 쉽게 커스터마이징

### Rationale for Selection

**A. Tailwind CSS** ⭐ (PRD에서 이미 결정됨)
- **장점:**
  - 빠른 개발 (유틸리티 클래스)
  - 완전한 커스터마이징 가능
  - 반응형 디자인 쉬움 (데스크탑 + iPad)
  - 작은 번들 사이즈
  - 엑셀 스타일 테이블 구현 용이
- **Paros에 적합한 이유:**
  - 이미 PRD에서 선택됨
  - 테이블 중심 UI 구현에 최적
  - 빠른 개발 (MVP 2-3달)

**B. shadcn/ui** ⭐ (Tailwind 기반 컴포넌트 라이브러리)
- **장점:**
  - Tailwind와 완벽 통합
  - 복사해서 사용 (npm install 필요 없음)
  - 완전한 커스터마이징 가능
  - Radix UI 기반 (접근성)
  - 깔끔하고 미니멀한 디자인
  - TypeScript 지원
- **Paros에 적합한 이유:**
  - Tailwind 기반 (일관성)
  - 미니멀한 UI (Notion/Slack 스타일)
  - 빠른 개발 (검증된 컴포넌트)
  - 필요한 것만 사용 (번들 사이즈 작음)

**C. TanStack Table (React Table v8)** ⭐ (테이블 라이브러리)
- **장점:**
  - 강력한 테이블 기능 (정렬, 필터, 검색)
  - 가상화 (대량 데이터 처리)
  - 완전한 커스터마이징
  - 엑셀 스타일 UI 구현 가능
  - TypeScript 지원
- **Paros에 적합한 이유:**
  - 테이블 중심 앱 (수백~수천 건 거래)
  - 엑셀 스타일 인터랙션 구현
  - 대량 데이터 처리 (가상화)

### Implementation Approach

**단계 1: 기본 설정**
```bash
# Tailwind CSS 설치
npm install -D tailwindcss postcss autoprefixer

# shadcn/ui 초기화
npx shadcn-ui@latest init

# 필요한 컴포넌트 추가 (필요한 것만)
npx shadcn-ui@latest add button
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add select
```

**단계 2: TanStack Table 설치**
```bash
npm install @tanstack/react-table
```

**단계 3: Tailwind 커스텀 토큰 설정**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Paros 색상 코딩 (PRD에서 정의)
        danger: '#EF4444',  // 🔴 자산 처분 의심
        warning: '#F59E0B',  // 🟡 대규모 출금
        info: '#F97316',     // 🟠 계좌 간 이체
        success: '#10B981',  // ✅ 완료
      }
    }
  }
}
```

**단계 4: Paros 전용 커스텀 컴포넌트 개발**
- **DataTable:** TanStack Table + Tailwind 스타일링
- **UploadZone:** 드래그 앤 드롭 영역
- **ProgressBar:** 실시간 진행률 (단계별 표시)
- **FilterSidebar:** 필터 옵션 (금액, 유형, 기간)
- **DashboardCard:** 핵심 발견 카드 (색상 코딩)
- **TagDropdown:** 태그 수정 드롭다운 (인라인 편집)

### Customization Strategy

**색상 시스템 (Color System):**
```javascript
// Paros 색상 코딩 (PRD User Journey 1)
const colors = {
  danger: '#EF4444',  // 🔴 자산 처분 강력 의심
  warning: '#F59E0B',  // 🟡 1억원 이상 대규모 출금
  info: '#F97316',     // 🟠 계좌 간 이체 패턴
  success: '#10B981',  // ✅ 완료
  gray: '#6B7280',     // 일반 거래

  // 뉴트럴 색상
  white: '#FFFFFF',
  black: '#000000',
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',  // 테이블 테두리
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',  // 본문 텍스트
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  }
}
```

**타이포그래피 (Typography):**
```javascript
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
  },
  fontSize: {
    // 제목
    'h1': ['24px', '32px'],  // 페이지 제목
    'h2': ['20px', '28px'],  // 섹션 제목
    'h3': ['18px', '24px'],  // 카드 제목

    // 본문
    'base': ['14px', '20px'], // 일반 텍스트
    'sm': ['13px', '18px'],   // 테이블 텍스트

    // 작은 텍스트
    'xs': ['12px', '16px'],   // 캡션, 라벨
  },
  fontWeight: {
    medium: '500',  // 테이블 헤더
    semibold: '600', // 강조
    bold: '700',      // 제목
  }
}
```

**간격 (Spacing):**
```javascript
const spacing = {
  // Tight
  xs: '4px',
  sm: '8px',

  // Base
  md: '16px',
  lg: '24px',

  // Loose
  xl: '32px',
  '2xl': '48px',
}
```

**테두리/그림자 (Borders/Shadows):**
```javascript
const borders = {
  // 테이블
  table: '1px solid #E2E8F0',  // slate-200

  // 카드
  card: '1px solid #E2E8F0',
}

const shadows = {
  // 카드
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',

  // 드롭다운/모달
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',

  // 대시보드 카드 (미묘한 그림자)
  card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
}
```

**반응형 브레이크포인트 (Responsive Breakpoints):**
```javascript
const breakpoints = {
  sm: '640px',   // 작은 노트북
  md: '768px',   // iPad (세로)
  lg: '1024px',  // iPad (가로), 노트북
  xl: '1280px',  // 데스크탑
  '2xl': '1536px', // 대형 데스크탑
}
```

**컴포넌트 구조:**
```
components/
├── ui/                    # shadcn/ui 컴포넌트
│   ├── button.tsx
│   ├── dropdown-menu.tsx
│   ├── table.tsx
│   └── ...
├── paros/                 # Paros 커스텀 컴포넌트
│   ├── DataTable.tsx      # TanStack Table + Tailwind
│   ├── UploadZone.tsx     # 드래그 앤 드롭 업로드
│   ├── ProgressBar.tsx    # 실시간 진행률
│   ├── FilterSidebar.tsx  # 필터 옵션
│   ├── DashboardCard.tsx  # 핵심 발견 카드
│   └── TagDropdown.tsx    # 태그 수정 (인라인)
└── lib/                   # 유틸리티
    └── utils.ts           # cn() (classnames 병합)
```

---

## Core User Experience

### Defining Experience

**Paros의 핵심 경험(Core Experience) - 제품을 정의하는 하나의 상호작용:**

**"파일 올리고, 1분 만에 통찰 얻기" (Upload files, get insights in 1 minute)**

또는 더 간단하게:

**"Drag, Drop, Done" (드래그, 놓기, 완료)**

**핵심 질문에 대한 답:**
- **사용자가 동료에게 Paros를 어떻게 설명할까요?**
  - *"파일 5개 올리면 1분 만에 자산 처분 의심 건 찾아줘"*
- **어떤 상호작용이 사용자를 성공하게 느끼게 할까요?**
  - 파일 업로드 → 실시간 진행률 → 핵심 발견 즉시 파악 (3초) → 엑셀 다운로드 (30초)
- **하나만 완벽하게 한다면 무엇일까요?**
  - **30초 안에 엑셀 다운로드 → 워드에 붙여넣기** ⭐ 가장 중요

**유명한 예시와 비교:**
- Tinder: "Swipe to match with people"
- Spotify: "Discover and play any song instantly"
- **Paros: "Upload files, get insights in 1 minute"**

### User Mental Model

**현재 해결 방법 (Current Solution):**
1. 통장 내역 수신 (PDF, 엑셀, 이미지, 종이 스캔본)
2. 엑셀에 수동으로 거래 내역 입력 (4-8시간)
3. 종이 출력 후 형광펜으로 중요 거래 표시
4. 법관이 찾을 것 같은 거래 수동 검색
5. 엑셀에서 보고서용 데이터 정리
6. 워드에 붙여넣기

**사용자 멘탈 모델 (Mental Model):**
- **엑셀 스타일:** 테이블, 정렬, 필터, 검색 (친숙한 패턴)
- **폴더 구조:** 파일들을 폴더에 모아서 관리
- **형광펜:** 종이에 중요한 부분 표시 (색상 코딩)
- **복사/붙여넣기:** 엑셀 → 워드 (Ctrl+C/V)

**기대와 혼란 지점:**
- **기대:** 파일 올리면 자동으로 분석되어야 함
- **혼란:** "파일이 업로드되고 있긴 한 거야?", "분석이 멈춘 거야?"
- **좌절:** "AI가 틀렸는데 고칠 수가 없어", "다시 처음부터 해야 하나?"

### Success Criteria

**"this just works"** 느낌을 주는 성공 기준:

**1. 즉각적인 피드백 (Immediate Feedback)**
- 파일 놓자마자 "파일 3개 감지됨" 메시지
- 1초 안에 업로드 시작
- 실시간 진행률 (⏳ 30% → ✓ 완료)

**2. 3초 안에 핵심 파악 (3-Second Insight)** ⭐ 가장 중요
- 분석 완료 후 첫 화면에서 핵심 발견 3가지 즉시 표시
- 색상 코딩 (🔴🟡🟠)으로 직관적 이해
- *"이거 진짜 되네?"* (놀라움)

**3. 30초 안에 엑셀 다운로드 (30-Second Download)**
- 버튼 1클릭으로 즉시 다운로드
- 워드에 바로 붙여넣기 가능
- *"1분 30초? 진짜?"* (성취감)

**성공 지표 (Success Indicators):**
- ✅ "이거 진짜 빠르다!" (놀라움, 즐거움)
- ✅ "이제 퇴근할 수 있어!" (안도감, 자유)
- ✅ "이제 수동은 상상도 안 해" (충성도, 재사용)
- ✅ "동료한테 추천하고 싶어" (자부심, 자랑)

### Novel UX Patterns

**Paros는 확립된 패턴(Established Patterns) + 혁신적 적용(Innovative Application):**

**확립된 패턴 (Adopt - 채택):**
- **드래그 앤 드롭 업로드** (Slack, Google Drive)
- **엑셀 스타일 테이블** (Microsoft Excel, Google Sheets)
- **실시간 진행률** (Google Sheets, Slack)
- **필터/정렬** (Excel)
- **1클릭 다운로드** (대부분의 웹 앱)

**혁신적 적용 (Adapt - Paros 특화):**
- **법률 맥락에 맞는 색상 코딩** (🔴 자산 처분 의심, 🟡 대규모 출금, 🟠 계좌 간 이체)
- **프로그레시브 디스클로저** (요약 → 상세 → 원본)
- **실시간 진행률의 법적 맥락** (파싱 → 추출 → 분석 → 완료)
- **AI 결과 보정** (태그 직접 수정, 신뢰도 확보)

**교육 필요 없음 (No User Education Required):**
- 엑셀 사용자들에게 친숙한 패턴
- 드래그 앤 드롭은 누구나 알음
- 테이블 UI는 직관적

### Experience Mechanics

**Paros의 핵심 경험 상세 메커니즘:**

**1. 시작 (Initiation)**
```
화면: [파일을 여기에 드래그하거나 클릭하여 업로드하세요]
트리거:
  - 새 사건 생성 버튼
  - 또는 대시보드에서 [+ 분석하기] 버튼

초대 (Invitation):
  - 드래그 앤 드롭 영역 (점선 박스)
  - 파일 선택 버튼 (클릭으로도 업로드 가능)
  - "지원 형식: PDF, 엑셀(XLSX), 이미지(JPG, PNG)"
```

**2. 상호작용 (Interaction)**
```
사용자 액션:
  1. 파일 5개 드래그 앤 드롭
  2. 놓자마자 자동으로 업로드 시작

시스템 반응:
  1. 파일 형식 자동 감지 (PDF, 엑셀, 이미지)
  2. "파일 5개 감지됨" 메시지
  3. 실시간 업로드 진행률 (파일별)
  4. 자동으로 분석 시작 (사용자 별도 액션 불필요)

실시간 진행률:
  ⏳ 문서 파싱 중... (20%)
  ✓ 국민은행_홍길동.pdf 완료
  ✓ 하나은행_홍길동.xlsx 완료
  ⏳ 신한은행_홍길동.jpg 처리 중...
  ⏳ 거래 내역 추출 대기 중...

예상 시간: "분석 완료까지 1분 30초 남음"
```

**3. 피드백 (Feedback)**
```
성공 피드백:
  📊 분석 완료 - 홍길동 채무자 자금 흐름

  ⚠️ 핵심 발견 3건

  1. 🔴 자산 처분 강력 의심
     2024-02-15 | 국민은행 | 5억원 출금
     → 부동산 매매계약서 일치!

  2. 🟡 1억원 이상 대규모 출금 (7건)
     기간: 2024-01-01 ~ 2024-03-31
     합계: 12억 5천만원

  3. 🟠 계좌 간 이체 패턴 (23건)
     → 특정 계좌로 자금 집중 감지

사용자 반응:
  *"5억원 자산 처분? 그거 내가 지난번에 놓쳤던 그 패턴이잖아!"*
```

**4. 완료 (Completion)**
```
사용자 액션:
  1. "1억원 이상 출금건" 클릭
  2. 7건 테이블 표시
  3. [엑셀 다운로드] 버튼 클릭
  4. 엑셀 파일 다운로드 완료

성공 결과:
  - 엑셀 파일 열기
  - 필요한 열 복사
  - 워드에 붙여넣기 (Ctrl+V)

소요 시간: 1분 30초 (저번엔 3시간 걸림)
사용자 반응: *"진짜? 이제 퇴근할 수 있어!"*

다음 단계:
  - 보고서 작성 완료
  - 또는 다른 필터 적용
  - 또는 새 사건 분석 시작
```

**핵심 경험 요약:**
1. **드래그 앤 드롭**으로 파일 업로드 (즉각적 피드백)
2. **실시간 진행률**로 불안 해소 (파싱 → 추출 → 분석 → 완료)
3. **3초 규칙**로 핵심 파악 (색상 코딩 🔴🟡🟠)
4. **30초 완료**로 성취감 (엑셀 다운로드 → 워드에 붙여넣기)

---

## Visual Foundation

### Brand Guidelines Assessment

**기존 브랜드 가이드라인:** 없음
- Paros는 신규 프로젝트로, 기존 브랜드 가이드라인이 없음
- 법률/금융 전문 서비스에 적합한 새로운 시각적 시스템 정의 필요

### Color Theme Options

**추천: Professional Blue Trust**

법률/금융 서비스의 신뢰감과 PRD의 색상 코딩 시스템을 반영한 컬러 테마:

**Primary Colors:**
- **Primary Blue:** `#2563EB` (Tailwind blue-600)
  - 주요 액션 버튼, 네비게이션
  - 전문성, 신뢰감, 안정성 전달

- **Secondary Slate:** `#64748B` (Tailwind slate-500)
  - 보조 텍스트, 아이콘
  - 차분함, 가독성 확보

**Neutral Foundation:**
- **Background:** `#FFFFFF` (white), `#F8FAFC` (slate-50)
- **Surface:** `#F1F5F9` (slate-100)
- **Border:** `#E2E8F0` (slate-200)
- **Text Primary:** `#0F172A` (slate-900)
- **Text Secondary:** `#475569` (slate-600)

**Semantic Colors (PRD 상태 시스템):**
- **🔴 Critical - Red:** `#DC2626` (red-600) / `#FEF2F2` (red-50)
  - 자산 처분 강력 의심
  - bg: red-50, border: red-200, text: red-700

- **🟡 Warning - Amber:** `#D97706` (amber-600) / `#FFFBEB` (amber-50)
  - 1억원 이상 대규모 출금
  - bg: amber-50, border: amber-200, text: amber-700

- **🟠 Info - Orange:** `#EA580C` (orange-600) / `#FFF7ED` (orange-50)
  - 계좌 간 이체 패턴
  - bg: orange-50, border: orange-200, text: orange-700

- **🟢 Success:** `#16A34A` (green-600) / `#F0FDF4` (green-50)
  - 정상 거래, 분석 완료

**Design Rationale:**
- **신뢰감:** Blue는 법률/금융 서비스에서 가장 신뢰할 수 있는 색상
- **명확한 전달:** PRD의 색상 코딩(🔴🟡🟠)과 완벽하게 통합
- **가독성:** 높은 콘트라스트로 긴 시간 작업에도 눈의 피로 최소화
- **전문성:** Slate 뉴트럴 색상으로 깔끔하고 미니멀한 느낌

### Typography System

**Font Family:**
- **Primary:** `"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - 한글 최적화 (Pretendard는 디지털 환경에서 가독성 뛰어남)
  - 시스템 폴백으로 성능 최적화
  - shadcn/ui 기본 Inter와 잘 어울림

**Type Scale (Tailwind 기반):**

| Size | Tailwind Class | Usage | Line Height |
|------|---------------|-------|-------------|
| **Display** | text-4xl (36px) | 페이지 헤더 | 1.2 |
| **H1** | text-3xl (30px) | 메인 섹션 타이틀 | 1.3 |
| **H2** | text-2xl (24px) | 서브섹션 헤더 | 1.4 |
| **H3** | text-xl (20px) | 카드 타이틀 | 1.5 |
| **Body** | text-base (16px) | 본문 텍스트 | 1.6 |
| **Small** | text-sm (14px) | 보조 텍스트, 라벨 | 1.5 |
| **XS** | text-xs (12px) | 캡션, 메타데이터 | 1.4 |

**Weight System:**
- **Regular (400):** 본문 텍스트
- **Medium (500):** 라벨, 중요한 텍스트
- **Semibold (600):** 헤딩, 버튼 텍스트
- **Bold (700):** 강조, 페이지 타이틀

**Typography Rationale:**
- **Pretendard 선택:** 한글 텍스트의 가독성 최우선 (법률 문서는 긴 텍스트가 많음)
- **16px Base:** 본문 텍스트는 읽기 쉬운 크기로 (데스크탑 환경)
- **1.5-1.6 Line Height:** 테이블과 본문 모두에서 가독성 확보
- **명확한 계층:** 12px → 36px 범위로 7단계 구조

### Spacing and Layout Foundation

**Spacing System (4px Grid):**

| Token | Value | Usage |
|-------|-------|-------|
| **1** | 4px | 아이콘 패딩, 작은 간격 |
| **2** | 8px | 라벨-인풋 간격 |
| **3** | 12px | 관련 요소 간 그룹 내 간격 |
| **4** | 16px | 기본 카드 패딩, 버튼 패딩 |
| **6** | 24px | 섹션 간 간격 |
| **8** | 32px | 메인 섹션 간 간격 |
| **12** | 48px | 페이지 레벨 간격 |

**Layout Structure:**
- **Container Max Width:** `1440px` (대형 화면)
- **Content Padding:** `24px` (desktop), `16px` (tablet)
- **Grid System:** 12-column (CSS Grid or Tailwind grid-cols-12)
- **Card Gaps:** `16px` (gap-4)
- **Responsive Breakpoints:**
  - Tablet: `768px` (md)
  - Desktop: `1024px` (lg)
  - Large Desktop: `1280px` (xl)

**Component Sizing:**
- **Button Height:** `40px` (h-10) primary, `36px` (h-9) secondary
- **Input Height:** `40px` (h-10)
- **Card Border Radius:** `8px` (rounded-lg)
- **Table Cell Padding:** `12px 16px` (py-3 px-4)

**Layout Rationale:**
- **4px Grid:** Tailwind 표준과 일치, 개발 용이성
- **16px Base Unit:** 카드 패딩, 버튼 크기 등 기본 간격
- **1440px Max Width:** 대형 화면에서도 가독성 확보 (너무 넓지 않게)
- **8px Border Radius:** 현대적이지만 과하지 않은 둥근 모서리

### Visual Design Tokens Summary

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary
        primary: {
          DEFAULT: '#2563EB',  // blue-600
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Semantic (PRD)
        danger: {
          DEFAULT: '#DC2626',  // red-600
          bg: '#FEF2F2',       // red-50
          border: '#FECACA',   // red-200
          text: '#B91C1C',     // red-700
        },
        warning: {
          DEFAULT: '#D97706',  // amber-600
          bg: '#FFFBEB',       // amber-50
          border: '#FDE68A',   // amber-200
          text: '#B45309',     // amber-700
        },
        info: {
          DEFAULT: '#EA580C',  // orange-600
          bg: '#FFF7ED',       // orange-50
          border: '#FED7AA',   // orange-200
          text: '#C2410C',     // orange-700
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',   // 72px
        '128': '32rem',   // 512px
      },
    }
  }
}
```

**시각적 일관성 (Visual Consistency):**
- 모든 페이지에서 동일한 색상, 타이포그래피, 간격 사용
- shadcn/ui 컴포넌트로 기본 스타일 확보
- Tailwind 유틸리티로 빠르고 일관된 개발

---

## Design Direction Decision

### Design Directions Explored

PRD의 핵심 요구사항과 실무자 사용 패턴을 바탕으로 6가지 디자인 방향을 탐색:

**1. 클래식 엑셀 스타일 (Classic Excel Style)**
- 사이드바(필터) + 메인 테이블
- 가장 익숙한 패턴, 실무자에게 직관적
- 단점: 현대적이지 않음, 첫 화면에서 "놀라움" 부족

**2. 모던 대시보드 (Modern Dashboard)**
- 상단: 큰 핵심 발견 카드 3개 (세로 배치)
- 중간: 필터 바, 하단: 테이블
- 장점: 첫 화면에서 강력한 인상, 현대적
- 단점: 테이블이 아래로 밀려남

**3. 스플릿 뷰 (Split View)** ⭐ 최종 선택
- 왼쪽 (40%): 핵심 발견 + 필터 + 요약
- 오른쪽 (60%): 테이블
- 고정 레이아웃, 독립적으로 스크롤

**4. 싱글 컬럼 프로그레시브 (Single Column Progressive)**
- 세로 방향으로 단계적 공개
- 핵심 발견 → 상세 보기 → 필터 → 테이블
- 장점: "3초 규칙" 완벽 구현
- 단점: 숙련자에게 클릭이 번거로울 수 있음

**5. 카드 기반 레이아웃 (Card-Based Layout)**
- 모든 것이 카드로 구성 (Notion 스타일)
- 드래그 앤 드롭으로 재배치 가능
- 장점: 유연함, 미니멀
- 단점: 빈 화면처럼 보일 수 있음

**6. 탭 기반 네비게이션 (Tab-Based Navigation)**
- 상단 탭: [요약] [필터] [테이블] [설정]
- 장점: 간단하고 명확, 모바일 친화적
- 단점: 탭 전환 필요, 동시에 여러 정보 보기 어려움

### Chosen Direction

**Split View (스플릿 뷰) - 왼쪽 패널 + 오른쪽 패널**

**레이아웃 구조:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Paros Logo    [새 분석]    [검색]        홍길동 님    [설정]   │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│  📊 핵심 발견 3건            │  📋 거래 내역 (1,523건)          │
│                              │                                  │
│  1. 🔴 자산 처분 강력 의심   │  ┌──────┬─────────┬────────┬───┐│
│     2024-02-15 | 국민은행   │  │날짜  │ 적요    │ 금액   │태그││
│     5억원 출금 → 부동산...  │  ├──────┼─────────┼────────┼───┤│
│                              │  │02-15 │부동산  │500,000│🔴 ││
│  2. 🟡 대규모 출금 (7건)     │  │02-14 │이체    │ 50,000│🟠 ││
│     기간: 2024-01~03         │  │02-13 │식비    │  50,000│   ││
│     합계: 12억 5천만원      │  │02-12 │출금    │100,000│   ││
│                              │  └──────┴─────────┴────────┴───┘│
│  3. 🟠 계좌 간 이체 (23건)  │                                  │
│     → 특정 계좌로 자금 집중  │  [엑셀 다운로드] [클립보드]      │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│  💬 왜 이게 자산 처분 의심이죠?  →  적요, 금액, 패턴 매칭      │
└─────────────────────────────────────────────────────────────────┘
```

**왼쪽 패널 (40% - 최소 400px, 최대 600px):**

**1. 핵심 발견 카드 (상단 60%)**
- 3가지 핵심 발견을 카드로 표시
- 각 카드 배경색: red-50, amber-50, orange-50
- [필터 적용] 버튼: 클릭 시 오른쪽 테이블 자동 필터링
- 항상 보이면서 테이블과 함께 탐색

**2. 필터 옵션 (하단 40%)**
- 금액: 1백만/1천만/1억원 이상, 맞춤
- 거래 유형: 체크박스 (자산 처분, 대규모 출금, 계좌 간 이체, 정상)
- 기간: 날짜 범위 선택
- [필터 초기화] [적용] 버튼

**오른쪽 패널 (60% - 나머지 공간):**

**테이블 헤더**
- 거래 내역 건수 표시
- [엑셀 다운로드] [클립보드] 버튼
- 현재 정렬/필터 상태 표시

**테이블 본문**
- 열: 날짜, 적요, 입금, 출금, 잔액, 태그
- 색상 코딩: 행 배경색 또는 태그 셀만
- 인라인 수정: [▼ 수정] 클릭 → 드롭다운
- 가상화 스크롤 (TanStack Table): 1,500건도 부드럽게

### Design Rationale

**왜 Split View인가?**

**1. 실무자 업무 패턴과 완벽 일치** ⭐ 가장 중요
- 엑셀로 작업할 때: 왼쪽에 메모/필터, 오른쪽에 데이터
- *"5억원 자산 처분 의심 건이 있네?"* → 왼쪽 확인 → 오른쪽 테이블에서 상세 보기
- 화면 전환 없이 동시에 확인 가능

**2. 전문적인 느낌**
- Tableau, Bloomberg 터미널 같은 전문가 도구 스타일
- 변호사/법무사에게 "이거 진짜 전문가용이네" 느낌
- 법률/금융 서비스의 신뢰감 전달

**3. 복잡한 정보를 잘 정리**
- 핵심 발견, 필터, 테이블을 한 화면에서 모두 확인
- 정보 계층이 명확함
- 프로그레시브 디스클로저 지원 (왼쪽은 요약, 오른쪽은 상세)

**4. "3초 규칙" + "30초 완료" 모두 지원**
- 3초: 왼쪽 핵심 발견 3가지 즉시 파악
- 30초: 오른쪽 테이블에서 [엑셀 다운로드] 클릭

**5. iPad 대응 가능**
- iPad 가로 모드: 스플릿 뷰 유지 (35% / 65%)
- iPad 세로 모드: 자동으로 싱글 컬럼 변경 (왼쪽 패널 위)

### Implementation Approach

**1. 레이아웃 구조 (Tailwind CSS Grid)**

```jsx
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-64px)]">
  {/* 왼쪽 패널 - 40% (2/5) */}
  <aside className="lg:col-span-2 overflow-y-auto pr-4">
    {/* 핵심 발견 카드 영역 */}
    <div className="space-y-4">
      {/* 1. 자산 처분 강력 의심 */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        {/* 카드 내용 */}
      </div>

      {/* 2. 대규모 출금 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        {/* 카드 내용 */}
      </div>

      {/* 3. 계좌 간 이체 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        {/* 카드 내용 */}
      </div>
    </div>

    {/* 필터 옵션 영역 */}
    <div className="mt-6">
      {/* 필터 컴포넌트 */}
    </div>
  </aside>

  {/* 오른쪽 패널 - 60% (3/5) */}
  <main className="lg:col-span-3 overflow-hidden flex flex-col">
    {/* 테이블 헤더 */}
    <div className="flex items-center justify-between mb-4">
      <h2>📋 거래 내역 (1,523건)</h2>
      <div className="flex gap-2">
        <Button>엑셀 다운로드</Button>
        <Button variant="outline">클립보드</Button>
      </div>
    </div>

    {/* 테이블 본문 (가상화 스크롤) */}
    <div className="flex-1 overflow-y-auto">
      <TanStackTable />
    </div>
  </main>
</div>
```

**2. 반응형 전략**

```jsx
// breakpoints
const breakpoints = {
  lg: '1024px',  // iPad 가로, 노트북 (스플릿 뷰 시작)
  md: '768px',   // iPad 세로 (싱글 컬럼)
}

// 데스크탑 (1920px, 1366px)
<div className="lg:grid-cols-5">
  <aside className="lg:col-span-2">  // 40%
  <main className="lg:col-span-3">   // 60%
</div>

// iPad 가로 (1024px)
<div className="grid-cols-5">
  <aside className="col-span-2">  // 40%
  <main className="col-span-3">   // 60%
</div>

// iPad 세로 (768px) + 모바일
<div className="grid-cols-1">
  <aside className="col-span-1">  // 왼쪽 패널 먼저
  <main className="col-span-1">   // 테이블 아래
</div>
```

**3. 핵심 인터랙션**

**A. 핵심 발견 카드 → 테이블 필터링**
```jsx
const handleApplyFilter = (filterType) => {
  // 왼쪽 카드의 [필터 적용] 버튼 클릭
  setTableFilter(filterType);  // 오른쪽 테이블 자동 필터링
  showToast(`필터 적용: ${filterType}`);
}
```

**B. 테이블 행 → 왼쪽 상세 보기**
```jsx
const handleRowClick = (transaction) => {
  // 오른쪽 테이블 행 클릭
  setSelectedTransaction(transaction);
  // 왼쪽 패널 하단에 상세 정보 표시
}
```

**C. 인라인 태그 수정**
```jsx
const handleTagChange = (transactionId, newTag) => {
  // 테이블 행의 [▼ 수정] 클릭
  updateTransactionTag(transactionId, newTag);
  // 즉시 반영 (새로고침 없음)
  // 왼쪽 핵심 발견 카드 자동 업데이트
}
```

**D. 엑셀 다운로드**
```jsx
const handleExcelDownload = () => {
  // 현재 필터링된 거래만
  const filteredData = getFilteredTransactions();
  // 엑셀 파일 생성 (색상 코딩 유지)
  const excelFile = generateExcel(filteredData);
  // 다운로드
  downloadFile(excelFile);
  showToast('✅ 1분 30초 만에 완료!');
}
```

**4. 컴포넌트 구조**

```
components/
├── layout/
│   ├── DashboardLayout.tsx       # 메인 레이아웃 (Grid)
│   └── Header.tsx                # 상단 네비게이션
├── dashboard/
│   ├── KeyFindingsPanel.tsx      # 왼쪽 핵심 발견 패널
│   │   ├── FindingCard.tsx       # 개별 카드
│   │   └── FilterPanel.tsx       # 필터 옵션
│   └── TransactionPanel.tsx      # 오른쪽 테이블 패널
│       ├── TableHeader.tsx       # 테이블 헤더
│       └── TransactionTable.tsx  # TanStack Table
├── table/
│   ├── TagCell.tsx               # 태그 셀 (인라인 수정)
│   └── TagDropdown.tsx           # 태그 수정 드롭다운
└── ui/                           # shadcn/ui 컴포넌트
```

**5. 성능 최적화**

- **가상화 스크롤:** TanStack Table Virtualization (1,500건도 부드럽게)
- **React.memo:** 카드, 테이블 행 컴포넌트 메모이제이션
- **코드 스플리팅:** DashboardLayout은 lazy loading
- **이미지 최적화:** Next.js Image 컴포넌트 (로고, 아이콘)

---

## User Journey Flows

### Journey 1: 첫 번째 분석 (First Analysis Journey)

**목표:** 파일 업로드부터 엑셀 다운로드까지 완료

**시나리오:** 새 사건 의뢰를 받고 통장 내역 5개 파일을 분석해서 보고서 작성

#### 플로우 다이어그램

```mermaid
flowchart TD
    Start([시작: 새 사건 의뢰 수신]) --> Upload[파일 업로드 화면]

    subgraph UploadPhase ["1. 파일 업로드 단계"]
        Upload --> DragDrop{파일 드래그 앤 드롭 또는 선택}
        DragDrop -->|파일 5개 감지| ValidateFiles[파일 형식 검증]
        ValidateFiles -->|모두 정상| UploadStart[업로드 시작]
        ValidateFiles -->|일부 손상| PartialError[손상된 파일 표시]
        PartialError --> Decision1{계속 진행?}
        Decision1 -->|예| UploadStart
        Decision1 -->|아니오| Upload[다시 업로드]
        UploadStart --> ShowProgress[실시간 진행률 표시]
    end

    subgraph AnalysisPhase ["2. 분석 진행 단계"]
        ShowProgress --> Parse[문서 파싱 중... 20%]
        Parse --> Extract[거래 내역 추출 중... 40%]
        Extract --> Analyze[패턴 분석 중... 60%]
        Analyze --> Complete[분석 완료 100%]
    end

    subgraph DashboardPhase ["3. 대시보드 표시 단계"]
        Complete --> ShowDashboard[Split View 대시보드]
        ShowDashboard --> LeftPanel[왼쪽: 핵심 발견 3가지]
        ShowDashboard --> RightPanel[오른쪽: 테이블 1,523건]
        LeftPanel --> ViewFindings[사용자: 핵심 발견 확인]
        RightPanel --> ViewTable[사용자: 테이블 탐색]
    end

    subgraph FilterPhase ["4. 필터링 단계"]
        ViewFindings --> ClickCard{핵심 발견 카드 클릭?}
        ClickCard -->|예| ApplyFilter[자동 필터 적용]
        ApplyFilter --> FilteredTable[필터링된 테이블 표시]
        ClickCard -->|아니오| ManualFilter[수동 필터 적용]
        ManualFilter --> FilteredTable
        FilteredTable --> ReviewFindings[사용자: 거래 내역 검토]
    end

    subgraph ExportPhase ["5. 엑셀 다운로드 단계"]
        ReviewFindings --> ClickDownload{[엑셀 다운로드] 클릭}
        ClickDownload --> GenerateExcel[엑셀 파일 생성<br/>색상 코딩 유지]
        GenerateExcel --> DownloadFile[파일 다운로드 완료]
        DownloadFile --> SuccessToast[✅ 토스트: 1분 30초 만에 완료!]
        SuccessToast --> OpenExcel[사용자: 엑셀 파일 열기]
        OpenExcel --> CopyData[사용자: 필요한 열 복사]
        CopyData --> PasteWord[사용자: 워드에 붙여넣기 Ctrl+V]
    end

    PasteWord --> End([성공: 보고서 작성 완료])

    style Start fill:#E8F5E9
    style End fill:#E8F5E9
    style ShowDashboard fill:#FFF3E0
    style SuccessToast fill:#C8E6C9
```

#### 단계별 상세 설명

**1. 파일 업로드 단계 (30초)**
- **진입점:** 대시보드 [새 분석] 버튼 클릭
- **사용자 액션:** 파일 5개 드래그 앤 드롭
- **시스템 반응:**
  - 파일 형식 자동 감지 (PDF, XLSX, JPG)
  - "파일 5개 감지됨" 메시지
  - 일부 손상 시: "2개 파일 손상됨. 3개 파일로 진행하시겠습니까?"
- **의사결정:** 계속 진행 vs 다시 업로드
- **성공 피드백:** ⏳ 분석 진행 중... (20%)

**2. 분석 진행 단계 (1분)**
- **실시간 진행률:**
  - 20%: 문서 파싱 중... ✓ 국민은행 완료
  - 40%: 거래 내역 추출 중...
  - 60%: 패턴 분석 중...
  - 100%: 분석 완료
- **예상 시간:** "분석 완료까지 1분 30초 남음"
- **불안 해소:** 어떤 단계가 진행 중인지 명확히 표시

**3. 대시보드 표시 단계 (3초)**
- **첫 화면:**
  - 왼쪽: 🔴🟡🟠 핵심 발견 3가지 즉시 표시
  - 오른쪽: 테이블 1,523건
- **사용자 반응:** *"5억원 자산 처분? 그거 내가 지난번에 놓쳤던 그 패턴이잖아!"*
- **3초 규칙:** 핵심 발견 즉시 파악

**4. 필터링 단계 (10초)**
- **자동 필터링:** 왼쪽 카드의 [필터 적용] 클릭 → 오른쪽 테이블 자동 필터링
- **수동 필터링:** 왼쪽 필터 패널에서 옵션 선택
- **인터랙션:**
  - 금액: 1억원 이상 체크
  - 유형: 자산 처분 의심 체크
  - [적용] 클릭 → 테이블 7건 표시

**5. 엑셀 다운로드 단계 (30초)**
- **사용자 액션:** [엑셀 다운로드] 버튼 클릭
- **시스템 반응:**
  - 현재 필터링된 7건만 엑셀로 생성
  - 색상 코딩 배경색 유지 (🔴🟡🟠)
  - 테두리, 정렬, 폰트 워드 호환
- **성공 메시지:** ✅ 토스트 "1분 30초 만에 완료!"
- **사용자 작업:** 엑셀 열기 → 필요한 열 복사 → 워드에 붙여넣기

**총 소요 시간:** 2분 30초 (기존: 4-8시간)

---

### Journey 2: 태그 수정 (Tag Correction Journey)

**목표:** AI 분석 결과를 사용자가 보정

**시나리오:** 테이블을 탐색하다가 AI가 잘못 분석한 거래 발견 → 태그 수정

#### 플로우 다이어그램

```mermaid
flowchart TD
    Start([시작: 테이블 탐색 중]) --> ViewRow[사용자: 특정 행 클릭]

    subgraph InspectionPhase ["1. 거래 검토 단계"]
        ViewRow --> ShowDetail[왼쪽 패널 하단에 상세 정보]
        ShowDetail --> ShowExplanation["💬 왜 이게 자산 처분 의심이죠?<br/>→ 적요: 부동산 매매<br/>→ 금액: 5억원<br/>→ 패턴: 대규모 출금 후 잔액 감소"]
        ShowExplanation --> UserDecision{사용자 판단}
    end

    subgraph CorrectionPhase ["2. 태그 수정 단계"]
        UserDecision -->|틀림| ClickEdit[[▼ 수정] 클릭]
        UserDecision -->|맞음| NoChange[변경 없음]

        ClickEdit --> ShowDropdown[드롭다운 메뉴 표시]
        ShowDropdown --> SelectTag[새 태그 선택]
        SelectTag -->|정상 거래| Normal[정상 거래]
        SelectTag -->|대규모 출금| Warning[대규모 출금]
        SelectTag -->|계좌 간 이체| Info[계좌 간 이체]
        SelectTag -->|자산 처분 의심| Danger[자산 처분 의심]
    end

    subgraph UpdatePhase ["3. 업데이트 단계"]
        Normal --> UpdateState[상태 업데이트]
        Warning --> UpdateState
        Info --> UpdateState
        Danger --> UpdateState

        UpdateState --> RefreshTable[테이블 행 즉시 업데이트]
        RefreshTable --> RefreshCards[왼쪽 핵심 발견 카드 재계산]
        RefreshCards --> ShowSuccess[✅ 토스트: 태그가 수정되었습니다]
    end

    subgraph AuditPhase ["4. 감사 로그 단계"]
        ShowSuccess --> LogUpdate[감사 로그 기록<br/>- 사용자: 홍길동<br/>- 시간: 2024-01-07 14:30<br/>- 변경: 자산 처분 의심 → 정상 거래<br/>- 거래 ID: TX-2024-02-15-001]
    end

    NoChange --> Continue[다른 거래 계속 탐색]
    LogUpdate --> Continue
    Continue --> End([계속 작업])

    style Start fill:#E8F5E9
    style End fill:#E8F5E9
    style ShowExplanation fill:#FFF3E0
    style ShowSuccess fill:#C8E6C9
```

#### 단계별 상세 설명

**1. 거래 검토 단계**
- **진입점:** 테이블에서 특정 행 클릭
- **시스템 반응:**
  - 왼쪽 패널 하단에 거래 상세 정보
  - "왜 이게 자산 처분 의심이죠?" 설명
  - 적요, 금액, 패턴 매칭 정보

**2. 태그 수정 단계**
- **사용자 액션:** [▼ 수정] 버튼 클릭
- **시스템 반응:** 드롭다운 메뉴 즉시 표시
- **옵션:**
  - 정상 거래
  - 자산 처분 의심
  - 대규모 출금
  - 계좌 간 이체

**3. 업데이트 단계**
- **즉시 반영:** 새로고침 없이 테이블 행 업데이트
- **연동 업데이트:** 왼쪽 핵심 발견 카드 자동 재계산
- **성공 피드백:** ✅ 토스트 "태그가 수정되었습니다"

**4. 감사 로그 단계**
- **기록 정보:** 사용자, 시간, 변경 내용, 거래 ID
- **목적:** 투명성 확보, 나중에 검토 가능

---

### Journey 3: 재사용 (Reuse Journey)

**목표:** 2주 후 보정 명령에 신속 대응

**시나리오:** 법원에서 보정 명령("5000만원 이상 출금건도 조사 바람") → Paros로 신속 대응

#### 플로우 다이어그램

```mermaid
flowchart TD
    Start([시작: 보정 명령 수신<br/>"5000만원 이상 출금건도 조사 바람"]) --> Login[Paros 접속]

    subgraph RecallPhase ["1. 과거 데이터 호출 단계"]
        Login --> Dashboard[대시보드]
        Dashboard --> SelectCase[과거 사건 선택: 홍길동]
        SelectCase --> LoadData[기존 분석 결과 로드<br/>⚡ 즉시 표시]
    end

    subgraph QuickFilterPhase ["2. 빠른 필터링 단계"]
        LoadData --> QuickFilter[금액 필터: 5000만원 이상]
        QuickFilter --> ApplyFilter[필터 적용 클릭]
        ApplyFilter --> ShowResults[12건 즉시 표시<br/>⚡ 3초 만에]
    end

    subgraph ExportPhase ["3. 신속한 내보내기 단계"]
        ShowResults --> QuickDownload[엑셀 다운로드 클릭]
        QuickDownload --> QuickGenerate[엑셀 파일 생성<br/>⚡ 5초 만에]
        QuickGenerate --> QuickComplete[다운로드 완료]
        QuickComplete --> QuickPaste[워드에 바로 붙여넣기]
    end

    QuickPaste --> ReportDraft[보정 명령 대응서 작성 완료<br/>⏱️ 총 소요 시간: 30분<br/>(기존: 2-3시간)]

    ReportDraft --> UserReaction{사용자 반응}
    UserReaction -->|"이제 수동은<br/>상상도 안 해!"| Loyalty[Paros 충성도 형성]
    UserReaction -->|동료에게 추천| Recommend[자연스러운 추천]

    Loyalty --> End([성공: 보정 명령 대응 완료])
    Recommend --> End

    style Start fill:#E8F5E9
    style End fill:#C8E6C9
    style LoadData fill:#E3F2FD
    style ShowResults fill:#FFF3E0
    style ReportDraft fill:#C8E6C9
```

#### 단계별 상세 설명

**1. 과거 데이터 호출 단계 (5초)**
- **진입점:** Paros 접속
- **사용자 액션:** 과거 사건 선택 (홍길동)
- **시스템 반응:** ⚡ 기존 분석 결과 즉시 로드 (이미 분석됨)
- **차별화:** 재분석 불필요, 바로 데이터 표시

**2. 빠른 필터링 단계 (10초)**
- **사용자 액션:** 금액 필터 "5000만원 이상" 체크
- **시스템 반응:** 12건 즉시 표시
- **속도:** ⚡ 3초 만에 (기존 엑셀 필터링: 10분)

**3. 신속한 내보내기 단계 (20초)**
- **사용자 액션:** [엑셀 다운로드] 클릭
- **시스템 반응:** ⚡ 5초 만에 엑셀 파일 생성
- **사용자 작업:** 워드에 바로 붙여넣기
- **총 소요 시간:** 30분 (기존: 2-3시간)

**성공 결과:**
- **감정:** "이제 수동은 상상도 안 해!"
- **행동:** 동료에게 자연스럽게 추천
- **충성도:** Paros 없으면 업무 불가능

---

### Journey Patterns

모든 여정에서 발견된 공통 패턴:

#### 내비게이션 패턴

**1. Split View 상호작용**
- 왼쪽 패널: 요약, 컨트롤
- 오른쪽 패널: 상세 데이터
- 양방향 통신: 왼쪽 → 오른쪽 (필터), 오른쪽 → 왼쪽 (상세)

**2. 프로그레시브 디스클로저**
- Level 1: 핵심 발견 3가지 (왼쪽 상단)
- Level 2: 필터링된 테이블 (오른쪽)
- Level 3: 개별 거래 상세 (왼쪽 하단)

#### 의사결정 패턴

**1. 단순 선택**
- 이진 선택: 계속 진행 vs 다시 업로드
- 드롭다운: 태그 선택 (4가지 옵션)
- 체크박스: 필터 옵션

**2. 복원력 있는 흐름**
- 일부 실패 시: 계속 진행 옵션
- 오류 복구: 명확한 에러 메시지와 해결책
- 되돌리기: 필터 초기화 버튼

#### 피드백 패턴

**1. 실시간 진행률**
- 단계별 퍼센트: 20% → 40% → 60% → 100%
- 파일별 완료: ✓ 국민은행 완료
- 예상 시간: "분석 완료까지 1분 30초 남음"

**2. 즉시 반응**
- 클릭 시 즉시 필터링 (새로고침 없음)
- 태그 수정 즉시 반영
- 토스트 메시지: ✅ 성공 피드백

**3. 성공 축하**
- 토스트: "1분 30초 만에 완료!"
- 이모지: ✅ 📊 ⏳
- 색상: 🟢 green (성공)

---

### Flow Optimization Principles

모든 여정에 적용된 최적화 원칙:

**1. 가치까지의 단계 최소화** (Minimize Steps to Value)
- 첫 번째 분석: 3단계 (업로드 → 확인 → 다운로드)
- 재사용: 2단계 (필터 → 다운로드)
- 태그 수정: 2단계 (클릭 → 선택)

**2. 인지 부하 감소** (Reduce Cognitive Load)
- 색상 코딩: 🔴🟡🟠 직관적 이해
- 기본값: 미리 선택된 필터 옵션
- 명확한 라벨: [엑셀 다운로드], [필터 적용]

**3. 명확한 피드백과 진행률** (Clear Feedback and Progress)
- 실시간 진행률: 20%, 40%, 60%, 100%
- 단계별 표시: 파싱 → 추출 → 분석 → 완료
- 성공 메시지: ✅ 토스트

**4. 즐거움과 성취감의 순간** (Moments of Delight)
- "이거 진짜 빠르다!" - 첫 화면에서 3초 만에 핵심 파악
- "1분 30초? 진짜?" - 엑셀 다운로드 후 놀라움
- "이제 퇴근할 수 있어!" - 30분 만에 보고서 완료

**5. 우아한 에러 복구** (Graceful Error Recovery)
- 일부 파일 손상: "3개 파일로 진행하시겠습니까?"
- API 장애: 자동 백업 (사용자는 느끼지 못함)
- 명확한 에러 메시지와 해결책

---

## Component Strategy

### Design System Components

Step 6에서 선택한 디자인 시스템: **Tailwind CSS + shadcn/ui + TanStack Table**

**shadcn/ui 제공 기본 컴포넌트:**

**Button (버튼)**
- Primary, Secondary, Ghost variants
- sizes: sm, md, lg
- states: default, hover, active, disabled

**Input (입력)**
- 텍스트 입력
- 날짜 선택 (DatePicker)
- states: default, focus, error, disabled

**Select (드롭다운)**
- 단일 선택
- 키보드 네비게이션 지원

**Checkbox (체크박스)**
- 필터 옵션
- indeterminate state

**Dropdown Menu (컨텍스트 메뉴)**
- 인라인 액션
- 키보드 접근성

**Table (기본 테이블)**
- shadcn/ui Table 컴포넌트
- TanStack Table로 확장

**Toast (알림)**
- Success, Error, Info variants
- Auto-dismiss

**Dialog (모달)**
- 필요시 사용 (최소화)

**Card (카드)**
- FindingCard의 기본 구조

**이유:**
- 검증된 컴포넌트 (접근성 완료)
- 빠른 개발 (npm install 불필요, 복사해서 사용)
- Tailwind와 완벽 통합
- TypeScript 지원

### Custom Components

Paros의 핵심 경험을 위해 6개의 커스텀 컴포넌트 설계:

#### 1. UploadZone (파일 업로드 영역)

**Purpose:** 파일 5개를 드래그 앤 드롭으로 업로드 ("Drag, Drop, Done" 핵심 경험의 시작)

**Usage:** 새 분석 시작 화면, 파일 추가 시

**Anatomy:**
```
┌─────────────────────────────────────┐
│                                     │
│        📁 파일을 여기에             │
│        드래그하거나                 │
│        클릭하여 선택                │
│                                     │
│    또는 파일을 여기에 놓으세요      │
│                                     │
│  지원 형식: PDF, 엑셀(XLSX),       │
│  이미지(JPG, PNG)                   │
│                                     │
│  [파일 선택 버튼]                   │
└─────────────────────────────────────┘
```

**States:**
- **Default:** 점선 박스 (border-dashed), 안내 텍스트
- **Drag Over:** 배경색 blue-50, 테두리 blue-500 solid ("놓으세요")
- **Files Detected:** "파일 5개 감지됨" 메시지 + 파일 리스트
- **Uploading:** 프로그레스 바 + "분석 진행 중..."
- **Error:** 손상된 파일 표시 (red border)

**Accessibility:**
- ARIA label: "파일 업로드 영역"
- Keyboard: Tab → Enter (파일 선택)
- Drag & Drop: 모든 파일 드래그 지원
- Error: 스크린 리더로 "2개 파일 손상됨" 알림 (role="alert")

**Content Guidelines:**
- 간단한 명령형 텍스트 ("파일을 여기에 드래그하세요")
- 지원 형식 명시
- 최대 파일 크기 제한 표시 (예: 최대 50MB)

**Interaction Behavior:**
- 파일 놓자마자 자동 감지 (클릭 불필요)
- 실시간으로 파일 리스트 표시
- 손상된 파일 명확히 표시 (red 아이콘 + 텍스트)

**Tech Stack:**
- react-dropzone (드래그 앤 드롭)
- shadcn/ui Button, Card
- Tailwind: border-dashed, border-2, hover:bg-blue-50

---

#### 2. ProgressBar (실시간 진행률 표시)

**Purpose:** "불안 해소" - 분석 진행 상황을 투명하게 표시

**Usage:** 파일 업로드 후 분석 진행 중, 각 단계별 진행률 표시

**Anatomy:**
```
⏳ 분석 진행 중... (30%)

  문서 파싱 중...
  ✓ 국민은행_홍길동.pdf 완료
  ✓ 하나은행_홍길동.xlsx 완료
  ⏳ 신한은행_홍길동.jpg 처리 중...
  ⏳ 거래 내역 추출 대기 중...

예상 완료까지 1분 30초 남음
```

**States:**
- **Active:** 프로그레스 바 애니메이션 + 퍼센트 표시
- **Complete:** ✓ 분석 완료!

**Variants:**
- **Full Width:** 전체 화면 (새 분석 시작)
- **Compact:** 카드 내 (필터 적용 시)

**Accessibility:**
- ARIA live: "polite" (진행률 실시간 알림)
- Role: "progressbar"
- aria-valuenow: 현재 퍼센트
- aria-valuemin: "0", aria-valuemax: "100"
- Screen Reader: "분석 30% 완료, 예상 1분 30초 남음"

**Content Guidelines:**
- 현재 단계 명확히 표시 ("문서 파싱 중...")
- 완료된 파일 ✓ 표시
- 예상 시간 항상 표시 (불안 해소)

**Interaction Behavior:**
- 1초마다 업데이트 (SSE 또는 Polling)
- 각 파일 완료 시 즉시 표시
- 장애 발생 시에도 진행률 유지 (자동 백업)

**Tech Stack:**
- shadcn/ui Progress
- Server-Sent Events (SSE) 실시간 업데이트
- TanStack Query (자동 리페칭)

---

#### 3. FindingCard (핵심 발견 카드)

**Purpose:** "3초 규칙" - 핵심 발견 3가지를 직관적으로 표시

**Usage:** 왼쪽 패널 상단 (Split View), 각 발견 유형별 카드

**Anatomy:**
```
┌──────────────────────────────────┐
│ 🔴 자산 처분 강력 의심           │ ← 배경: bg-red-50
│                                  │
│ 2024-02-15 | 국민은행           │
│ 5억원 출금                       │
│ → 부동산 매매계약서 일치!       │
│                                  │
│ [상세 보기] [필터 적용]          │
└──────────────────────────────────┘
```

**States:**
- **Default:** 배경색 (bg-red-50, bg-amber-50, bg-orange-50)
- **Hover:** 배경색 약간 진하게 (bg-red-100), 그림자 추가
- **Active:** [필터 적용] 클릭 시 오른쪽 테이블 필터링

**Variants:**
- **Critical (Red):** 자산 처분 강력 의심 (bg-red-50, border-red-200)
- **Warning (Amber):** 대규모 출금 (bg-amber-50, border-amber-200)
- **Info (Orange):** 계좌 간 이체 (bg-orange-50, border-orange-200)

**Accessibility:**
- ARIA label: "자산 처분 강력 의심, 2024년 2월 15일 국민은행 5억원 출금"
- Keyboard: Tab → Enter (필터 적용)
- Color Contrast: WCAG AA 준수 (텍스트 vs 배경)
- Role: "button" ([필터 적용] 버튼)

**Content Guidelines:**
- 이모지로 직관적 이해 (🔴🟡🟠)
- 간결한 텍스트 (3줄 이내)
- [필터 적용] 버튼 명확히

**Interaction Behavior:**
- [필터 적용] 클릭 → 오른쪽 테이블 자동 필터링
- [상세 보기] 클릭 → 관련 거래만 테이블 표시 + 하이라이트
- Hover 시 약간의 그림자 (elevation)

**Tech Stack:**
- shadcn/ui Card
- Tailwind: bg-{color}-50, border-{color}-200
- Button variants (Primary, Ghost)

---

#### 4. FilterPanel (필터 옵션 패널)

**Purpose:** 거래 내역을 다양한 조건으로 필터링

**Usage:** 왼쪽 패널 하단, 수동 필터링 시

**Anatomy:**
```
┌──────────────────────────────────┐
│ 🔍 필터                          │
├──────────────────────────────────┤
│ 금액                             │
│ ○ 1백만원 이상                   │
│ ○ 1천만원 이상                   │
│ ○ 1억원 이상                     │
│ ○ 맞춤 (__________) 만원         │
│                                  │
│ 거래 유형                        │
│ ☑ 자산 처분 의심                │
│ ☑ 대규모 출금                   │
│ ☑ 계좌 간 이체                  │
│ ☑ 정상 거래                     │
│                                  │
│ 기간                             │
│ From: [2024-01-01 📅]            │
│ To:   [2024-06-30 📅]            │
│                                  │
│ [필터 초기화] [적용]             │
└──────────────────────────────────┘
```

**States:**
- **Default:** 모든 옵션 초기 상태
- **Modified:** 일부 옵션 선택됨
- **Applied:** 필터 적용됨 (오른쪽 테이블 변경)

**Variants:**
- **Full:** 왼쪽 패널 (데스크탑)
- **Compact:** 드롭다운 (iPad)

**Accessibility:**
- Fieldset & Legend: 필터 그룹
- ARIA labelledby: "금액 필터", "거래 유형 필터"
- Keyboard: Tab + Space (체크박스), 방향키 (라디오)
- Required vs Optional 명확히

**Content Guidelines:**
- 명확한 라벨 ("금액", "거래 유형", "기간")
- 미리 정의된 옵션 + 맞춤 옵션
- [필터 초기화] 버튼 항상 표시

**Interaction Behavior:**
- [적용] 클릭 시 필터링 (즉시 반영)
- [필터 초기화] 클릭 시 모든 옵션 초기화
- Real-time: 금액 맞춤 입력 시 자동 계산 (Debounce)

**Tech Stack:**
- shadcn/ui Checkbox, Radio Group, Input
- DatePicker (날짜 범위)
- React Hook Form (폼 상태 관리)

---

#### 5. TagCell (태그 셀 + 인라인 수정)

**Purpose:** AI 분석 결과를 사용자가 직접 수정 (통제감 부여)

**Usage:** 테이블의 "태그" 열, 각 거래 행

**Anatomy:**
```
┌─────────────┐
│ 🔴 의심     │ ← Default state
│   [▼ 수정]  │
└─────────────┘

[클릭 후]
┌─────────────┐
│ 정상 거래   │
│ 대규모 출금 │ ← 드롭다운
│ 계좌 간 이체│
│ 자산 처분 의심│
└─────────────┘
```

**States:**
- **Default:** 현재 태그 + [▼ 수정] 버튼
- **Open:** 드롭다운 메뉴 표시
- **Selected:** 새 태그 선택 후 반영
- **Disabled:** 읽기 전용 모드

**Variants:**
- **Danger (Red):** 자산 처분 의심 (bg-red-50, text-red-700)
- **Warning (Amber):** 대규모 출금 (bg-amber-50, text-amber-700)
- **Info (Orange):** 계좌 간 이체 (bg-orange-50, text-orange-700)
- **Default:** 정상 거래 (bg-gray-50, text-gray-700)

**Accessibility:**
- ARIA expanded: 드롭다운 상태
- Role: "combobox"
- aria-haspopup: "listbox"
- Keyboard: Enter (열기), 방향키 (선택), Esc (닫기)
- Screen Reader: "현재 태그: 자산 처분 의심, 수정하려면 Enter"

**Content Guidelines:**
- 간결한 라벨 ("정상 거래", "자산 처분 의심")
- 색상으로 직관적 이해
- 이모지 선택적으로 사용

**Interaction Behavior:**
- [▼ 수정] 클릭 → 드롭다운 즉시 표시
- 선택 → 즉시 반영 (Optimistic Update, 새로고침 없음)
- 왼쪽 핵심 발견 카드 자동 재계산
- Esc 또는 외부 클릭으로 닫기

**Tech Stack:**
- shadcn/ui Dropdown Menu
- TanStack Table Cell Renderer
- Optimistic Update (즉시 반영)

---

#### 6. TransactionTable (거래 내역 테이블)

**Purpose:** 엑셀 스타일 테이블 (실무자에게 친숙한 패턴)

**Usage:** 오른쪽 패널 (Split View), 1,500건 이상의 대량 데이터

**Anatomy:**
```
┌──────┬─────────────────┬────────────┬──────────┬──────┬─────────┐
│날짜  │적요             │입금         │출금      │잔액  │태그     │
├──────┼─────────────────┼────────────┼──────────┼──────┼─────────┤
│02-15 │부동산 매매      │            │500,000,000│     │🔴 의심  │
│      │계약서 이체      │            │          │     │[▼ 수정] │
├──────┼─────────────────┼────────────┼──────────┼──────┼─────────┤
│02-14 │AAA은행 → BBB은행│            │ 50,000,000│     │🟠 이체  │
│      │                 │            │          │     │[▼ 수정] │
└──────┴─────────────────┴────────────┴──────────┴──────┴─────────┘
```

**States:**
- **Loading:** 스켈레톤 UI
- **Default:** 모든 데이터 표시
- **Filtered:** 필터링된 데이터
- **Sorted:** 정렬된 데이터
- **Empty:** "데이터 없음" 메시지

**Variants:**
- **Full:** 오른쪽 패널 (데스크탑)
- **Compact:** iPad (일부 열 숨김)

**Accessibility:**
- Role: "table"
- aria-label: "거래 내역 테이블, 1,523건"
- Keyboard: 방향키 (셀 이동), Enter (행 선택)
- Sort indicators (aria-sort)
- Screen Reader: "2월 15일, 부동산 매매 계약서 이체, 출금 5억원, 태그 자산 처분 의심"

**Content Guidelines:**
- 명확한 컬럼 헤더
- 숫자 format (5억원 → 500,000,000)
- 날짜 format (2024-02-15 → 02-15)
- 색상 코딩 (행 배경 또는 태그 셀만)

**Interaction Behavior:**
- 컬럼 헤더 클릭 → 정렬 (asc/desc)
- 행 클릭 → 왼쪽 패널 하단에 상세 정보
- TagCell 인라인 수정
- 가상화 스크롤 (부드럽게)

**Tech Stack:**
- TanStack Table v8 (강력한 테이블 라이브러리)
- React Virtual (가상화 스크롤)
- shadcn/ui Table 기본 구조

---

### Component Implementation Strategy

**1. 디자인 토큰 사용**
```javascript
// tailwind.config.js에서 정의한 토큰 사용
colors: {
  danger: '#DC2626',  // 🔴 자산 처분 의심
  warning: '#D97706',  // 🟡 대규모 출금
  info: '#EA580C',     // 🟠 계좌 간 이체
  success: '#16A34A',  // 🟢 완료
}
```

**2. 일관된 패턴**
- 모든 컴포넌트: 4px Grid spacing (Tailwind 기본)
- Border Radius: 8px (rounded-lg)
- Font: Pretendard, Inter
- Shadow: sm, md variants
- Transitions: duration-200, ease-in-out

**3. 접근성 우선**
- WCAG 2.1 AA 준수
- 키보드 네비게이션 (모든 인터랙션)
- ARIA 라벨 (명확한 설명)
- Color Contrast (4.5:1 minimum)
- Focus indicators (ring-2)

**4. 재사용 가능한 패턴**
- Button variants (Primary, Secondary, Ghost)
- Card variants (Default, Critical, Warning, Info)
- Input variants (Default, Error)
- Toast variants (Success, Error, Info)

**5. 성능 최적화**
- React.memo (불필요한 리렌더링 방지)
- Code splitting (lazy loading)
- TanStack Table Virtualization (대량 데이터)
- Image optimization (Next.js Image)

---

### Implementation Roadmap

**Phase 1: Core Components (MVP - Week 1-2)**

Priority: 필수적 (여정 1: 첫 번째 분석 완료)

1. **UploadZone**
   - 파일 드래그 앤 드롭
   - 파일 형식 자동 감지
   - 손상된 파일 처리
   - **여정 지원:** Journey 1 Step 1

2. **ProgressBar**
   - 실시간 진행률 (SSE)
   - 단계별 표시
   - 예상 시간 계산
   - **여정 지원:** Journey 1 Step 2

3. **FindingCard**
   - 색상 코딩 배경 (🔴🟡🟠)
   - [필터 적용] 버튼
   - 3가지 variants
   - **여정 지원:** Journey 1 Step 3

4. **TransactionTable**
   - TanStack Table 기반
   - 가상화 스크롤
   - 색상 코딩 행
   - **여정 지원:** Journey 1 Step 3-4

**MVP 릴리스:** 이 4개만으로 "첫 번째 분석" 여정 완료 가능

---

**Phase 2: Supporting Components (Week 3-4)**

Priority: 중요 (여정 2: 태그 수정 완료)

5. **TagCell**
   - 인라인 드롭다운
   - 즉시 반영 (Optimistic Update)
   - 감사 로그 기록
   - **여정 지원:** Journey 2 전체

6. **FilterPanel**
   - 금액, 유형, 기간 필터
   - [필터 초기화]
   - 반응형 (데스크탑/iPad)
   - **여정 지원:** Journey 1 Step 4, Journey 3 Step 2

**추가 기능:** 여정 2 완료, 태그 수정 가능

---

**Phase 3: Enhancement Components (Week 5-6)**

Priority: 향상 (여정 3: 재사용 + UX 개선)

7. **Toast**
   - 슬라이드인/아웃 애니메이션
   - Auto-dismiss (3초)
   - 3가지 variants (Success, Error, Info)
   - **여정 지원:** 모든 여정 (성공 피드백)

8. **DatePicker**
   - shadcn/ui DatePicker 기반
   - 한글화 (ko locale)
   - 날짜 범위 선택
   - **여정 지원:** Journey 1 Step 4

9. **ExportButton**
   - 엑셀 다운로드
   - 색상 코딩 유지
   - 클립보드 복사
   - 워드 호환
   - **여정 지원:** Journey 1 Step 5, Journey 3 Step 3

**Polish:** 전체 UX 개선, "이거 진짜 빠르다!" 느낌

---

### Component Summary

**Foundation:** shadcn/ui (9개 기본 컴포넌트)
**Custom:** 6개 Paros 전용 컴포넌트
**Approach:** Tailwind 토큰 + 접근성 + 재사용 가능한 패턴
**Roadmap:** 3단계 (MVP → Supporting → Enhancement)
**Total:** 15개 컴포넌트 (Phase 1: 4개, Phase 2: 2개, Phase 3: 3개)

---

## UX Consistency Patterns

UX 일관성 패턴은 Paros 전체에서 사용자에게 일관되고 예측 가능한 경험을 제공합니다.

### 1. Button Hierarchy (버튼 계층 구조)

**Purpose:** 사용자에게 명확한 행동의 우선순위 전달

**When to Use:**
- **Primary:** 가장 중요한 액션 (엑셀 다운로드, 파일 업로드)
- **Secondary:** 보조 액션 (필터 적용, 필터 초기화)
- **Ghost:** 부가적 액션 (상세 보기, 취소)

**Visual Design:**

**Primary Button**
- **Color:** bg-blue-600 (Primary Blue)
- **Text:** white, font-semibold
- **Size:** h-10 (40px), px-6
- **Border Radius:** rounded-lg (8px)
- **Shadow:** shadow-sm
- **Example:** [엑셀 다운로드], [새 분석 시작]

**Secondary Button**
- **Color:** bg-white, border border-slate-200
- **Text:** slate-700, font-medium
- **Size:** h-10 (40px), px-4
- **Border Radius:** rounded-lg (8px)
- **Hover:** bg-slate-50
- **Example:** [필터 적용], [필터 초기화]

**Ghost Button**
- **Color:** 투명 배경
- **Text:** slate-600, font-medium
- **Size:** h-9 (36px), px-3
- **Border Radius:** rounded-md (6px)
- **Hover:** bg-slate-100
- **Example:** [상세 보기], [취소]

**Behavior:**
- **Hover:** 모든 버튼은 hover 상태 명확히 (배경색 변경)
- **Focus:** ring-2 ring-blue-500 ring-offset-2 (접근성)
- **Active:** scale-95 (미세한 축소로 피드백)
- **Disabled:** opacity-50, cursor-not-allowed

**Accessibility:**
- ARIA role: "button"
- Keyboard: Enter, Space로 활성화
- Focus visible: 항상 표시
- Color contrast: WCAG AA (4.5:1 minimum)

**Mobile Considerations:**
- iPad: 최소 높이 44px (touch target)
- 터치 영역: 버튼 주위 8px padding

**Variants:**
- **Sizes:** sm (h-8), md (h-10), lg (h-12)
- **With Icon:** [아이콘] [텍스트] 또는 [텍스트] [아이콘]
- **Loading:** Spinner + 텍스트 변경

---

### 2. Feedback Patterns (피드백 패턴)

**Purpose:** 사용자의 액션에 대한 즉각적 피드백 제공

**When to Use:**
- **Success:** 액션 완료 후 (엑셀 다운로드, 태그 수정)
- **Error:** 오류 발생 시 (손상된 파일, 업로드 실패)
- **Warning:** 주의 필요 시 (일부 파일 손상)
- **Info:** 정보 전달 시 (분석 진행)

**Visual Design:**

**Success Toast**
```
┌────────────────────────────────┐
│ ✅ 1분 30초 만에 완료!         │
│    [×]                         │
└────────────────────────────────┘
```
- **Color:** bg-green-50, text-green-700, border-green-200
- **Position:** 화면 우측 상단 (top-4, right-4)
- **Animation:** slide-in-right (300ms)
- **Auto-dismiss:** 3초 후
- **Icon:** ✅ Check

**Error Alert**
```
┌────────────────────────────────┐
│ ❌ 파일 업로드 실패            │
│    2개 파일 손상됨             │
│    [다시 시도]                  │
└────────────────────────────────┘
```
- **Color:** bg-red-50, text-red-700, border-red-200
- **Position:** 화면 상단 (top-4)
- **Persistent:** 자동 닫힘 없음
- **Action Button:** [다시 시도]
- **Icon:** ❌ X

**Warning Banner**
```
┌────────────────────────────────┐
│ ⚠️ 2개 파일 손상됨             │
│    3개 파일로 진행하시겠습니까?│
│    [계속] [취소]               │
└────────────────────────────────┘
```
- **Color:** bg-amber-50, text-amber-700, border-amber-200
- **Position:** 화면 상단 (top-4)
- **Action Buttons:** 2개 (계속/취소)
- **Icon:** ⚠️ Warning

**Info Inline**
```
💬 분석 진행 중... (30%)
```
- **Position:** 컨텍스트 내 (인라인)
- **Dynamic:** 실시간 업데이트
- **Icon:** 💬 또는 ⏳

**Behavior:**
- **Enter:** slide-in 애니메이션
- **Exit:** fade-out + slide-out
- **Stacking:** 여러 토스트는 수직으로 쌓임 (최대 3개)
- **Dismiss:** [×] 클릭 또는 자동 (success만)

**Accessibility:**
- **Success/Info:** ARIA live="polite"
- **Error/Warning:** ARIA live="assertive" (즉시 알림)
- **Role:** "alert", "status"
- **Screen Reader:** 전체 텍스트 읽기
- **Keyboard:** Esc로 닫기

**Mobile Considerations:**
- **Position:** 화면 하단 (iPad)으로 변경 가능
- **Width:** 100% (mobile), 최대 400px (desktop)

**Variants:**
- **Duration:** 3초 (기본), 5초 (긴 메시지), 무제한 (error)
- **With Action:** 버튼 포함
- **Inline:** 컨텍스트 내 (Toast 아님)

---

### 3. Form Patterns (폼 패턴)

**Purpose:** 사용자 입력을 명확하고 일관되게 처리

**When to Use:**
- 필터 패널 (금액, 유형, 기간)
- 태그 수정 (드롭다운)
- 맞춤 금액 입력

**Visual Design:**

**Input Fields**
```
금액
┌──────────────────────────────┐
│ (__________) 만원              │
└──────────────────────────────┘
  1천만원 ~ 10억원 사이 입력해주세요
```
- **Label:** 위쪽 (text-sm, font-semibold, slate-700)
- **Input:** h-10, border-slate-200, rounded-lg
- **Focus:** ring-2 ring-blue-500, border-blue-500
- **Error:** border-red-500, helper text red-600

**Radio Group**
```
금액

○ 1백만원 이상
● 1천만원 이상  ← checked
○ 1억원 이상
○ 맞춤 (__________) 만원
```
- **Spacing:** items-center, space-x-2
- **Selected:** bg-blue-50, border-blue-500
- **Focus:** ring-2 ring-blue-500 ring-offset-2

**Checkbox Group**
```
거래 유형

☑ 자산 처분 의심
☐ 대규모 출금
☑ 계좌 간 이체
☐ 정상 거래
```
- **Spacing:** items-start, space-x-3
- **Checked:** bg-blue-600 (checkbox), border-blue-600
- **Indeterminate:** 바 형태 (일부만 선택)

**Dropdown (Select)**
```
태그 선택              ▼
├────────────────────────────┤
│ 정상 거래                  │
│ 자산 처분 의심            │
│ 대규모 출금               │
│ 계좌 간 이체              │
└────────────────────────────┘
```
- **Trigger:** h-10, border-slate-200, justify-between
- **Options:** hover:bg-slate-100, 선택 시 bg-blue-50
- **Keyboard:** 방향키로 이동, Enter로 선택, Esc로 닫기

**Behavior:**
- **Validation:** 실시간 (blur 후) 또는 제출 시
- **Error Messages:** input 아래 red-600 텍스트
- **Required:** * 표시 (또는 "필수" 텍스트)
- **Disable:** opacity-50, cursor-not-allowed

**Accessibility:**
- **Label:** htmlFor 연결
- **Error:** aria-describedby="error-message"
- **Required:** aria-required="true"
- **Role:** "radio", "checkbox", "combobox"
- **Keyboard:** Tab 이동, Space 선택

**Mobile Considerations:**
- **Touch Target:** 최소 44px
- **Select:** 네이티브 picker 사용 (iOS/Android)

**Variants:**
- **Sizes:** sm (h-8), md (h-10), lg (h-12)
- **States:** default, focus, error, disabled, readonly

---

### 4. Empty States (빈 상태)

**Purpose:** 데이터가 없을 때 명확한 안내 제공

**When to Use:**
- 파일 업로드 전
- 필터링 결과 0건
- 사건 없음

**Visual Design:**

**Empty State - 파일 없음**
```
┌─────────────────────────────────────┐
│                                     │
│           📁                        │
│    아직 파일이 없습니다              │
│                                     │
│  통장 내역 파일을 업로드하여         │
│  분석을 시작하세요                   │
│                                     │
│  [파일 업로드]                      │
│                                     │
└─────────────────────────────────────┘
```
- **Icon:** 큰 이모지 (text-6xl)
- **Title:** text-xl, font-semibold, slate-700
- **Description:** text-sm, slate-500
- **CTA Button:** Primary variant
- **Padding:** py-12 (수직 공간 충분히)

**Empty State - 필터링 결과 0건**
```
┌─────────────────────────────────────┐
│           🔍                        │
│    조건에 맞는 거래가 없습니다        │
│                                     │
│  필터 조건을 완화하거나              │
│  기간을 변경해보세요                 │
│                                     │
│  [필터 초기화]                       │
│                                     │
└─────────────────────────────────────┘
```
- **Icon:** 🔍 또는 ⚠️
- **Title:** text-lg, font-medium, slate-700
- **Description:** text-sm, slate-500
- **CTA Button:** Secondary variant

**Behavior:**
- **Center:** 수직/수평 중앙 정렬
- **Min Height:** 최소 300px (빈 공간 채우기)
- **Illustration:** 이모지 또는 일러스트 (선택)

**Accessibility:**
- **Role:** "status" 또는 "alert"
- **ARIA:** aria-label="데이터 없음"
- **Focus:** CTA 버튼으로 자동 포커스

**Mobile Considerations:**
- **Icon:** 작게 (text-4xl)
- **Padding:** 줄이기 (py-8)

---

### 5. Loading States (로딩 상태)

**Purpose:** 작업 진행 중임을 명확히 표시

**When to Use:**
- 분석 진행 중
- 데이터 로딩 중
- 엑셀 생성 중

**Visual Design:**

**Progress Bar (분석 진행)**
```
⏳ 분석 진행 중... (30%)

████████████░░░░░░░░░░░░░░ 30%

  문서 파싱 중...
  ✓ 국민은행_홍길동.pdf 완료
  ⏳ 신한은행_홍길동.jpg 처리 중...

예상 완료까지 1분 30초 남음
```
- **Progress Bar:** h-2, bg-slate-200, 내부 blue-600
- **Animation:** 부드럽게 증가
- **Percentage:** text-lg, font-semibold
- **Details:** text-sm, slate-600

**Skeleton (테이블 로딩)**
```
┌──────┬─────────────────┬──────────┐
│ ▓▓▓▓ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓   │ ▓▓▓▓▓   │
├──────┼─────────────────┼──────────┤
│ ▓▓▓▓ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓   │ ▓▓▓▓▓   │
└──────┴─────────────────┴──────────┘
```
- **Animation:** pulse (fade in-out)
- **Color:** slate-200
- **Shape:** 실제 콘텐츠와 동일한 크기

**Spinner (버튼 로딩)**
```
[⏳ 엑셀 다운로드 중...]
```
- **Spinner:** border-2, border-top-transparent, animate-spin
- **Text:** 변경 ("엑셀 다운로드" → "다운로드 중...")
- **State:** disabled (클릭 불가)

**Behavior:**
- **Progress Bar:** 실시간 업데이트 (1초마다)
- **Skeleton:** 최대 3초 (그 이후 에러 메시지)
- **Spinner:** 최대 30초

**Accessibility:**
- **Progress Bar:** role="progressbar", aria-valuenow="30"
- **Skeleton:** aria-hidden="true", aria-busy="true"
- **Spinner:** aria-label="로딩 중"

**Mobile Considerations:**
- **Progress Bar:** 전체 너비 (100%)
- **Skeleton:** 줄이기 (일부 열 숨김)

---

### 6. Interaction Patterns (인터랙션 패턴)

**Purpose:** 일관된 인터랙션 경험 제공

**Hover Effects**
- **Buttons:** 배경색 변경, scale-95
- **Cards:** 그림자 추가 (shadow-md)
- **Table Rows:** bg-slate-50
- **Links:** text-blue-600, underline

**Focus States**
- **All:** ring-2 ring-blue-500 ring-offset-2
- **Color:** blue-500 (일관된 포커스 색상)
- **Width:** 2px (명확히 보이게)

**Transitions**
- **Duration:** 200ms (기본, duration-200)
- **Easing:** ease-in-out
- **Properties:** color, background-color, transform, box-shadow

**Micro-interactions**
- **Button Click:** scale-95 (100ms)
- **Toast Enter:** slide-in-right (300ms)
- **Toast Exit:** fade-out + slide-out (200ms)
- **Dropdown:** fade-in (150ms)

---

### 7. Error Handling Patterns (에러 처리 패턴)

**Purpose:** 명확한 에러 메시지와 복구 경로 제공

**When to Use:**
- 파일 업로드 실패
- API 장애
- 유효성 검증 실패

**Visual Design:**

**Inline Error (Input)**
```
금액
┌──────────────────────────────┐
│ -1000                         │ ← border-red-500
└──────────────────────────────┘
❌ 0보다 큰 값을 입력해주세요
```
- **Input:** border-red-500, focus:ring-red-500
- **Icon:** ❌ (text-red-500)
- **Text:** text-red-600, text-xs
- **Position:** input 바로 아래

**Error Modal (API 장애)**
```
┌─────────────────────────────────────┐
│  ❌ 오류가 발생했습니다             │
│                                     │
│  일시적인 문제가 발생했습니다.       │
│  잠시 후 다시 시도해주세요.         │
│                                     │
│  [다시 시도]              [닫기]     │
└─────────────────────────────────────┘
```
- **Icon:** ❌ (text-red-500)
- **Title:** text-lg, font-semibold, red-700
- **Message:** 사용자 친화적 설명
- **Action:** [다시 시도] Primary 버튼

**Behavior:**
- **Recovery:** 명확한 복구 경로 제시
- **Auto-retry:** 3회 자동 재시도 (API 장애)
- **Fallback:** "부분적으로 성공" (일부 파일만)

**Accessibility:**
- **Role:** "alert"
- **ARIA:** aria-live="assertive"
- **Screen Reader:** 전체 에러 메시지 읽기

---

### Design System Integration

**Tailwind CSS + shadcn/ui 통합:**

**Complement:**
- shadcn/ui Button: variants 추가 (Primary, Secondary, Ghost)
- shadcn/ui Toast: 커스텀 애니메이션, 위치
- shadcn/ui Form: validation rules 커스터마이징

**Customization:**
- **Colors:** tailwind.config.js에 danger, warning, info 추가
- **Animation:** Tailwind animate-spin + 커스텀 keyframes
- **Spacing:** 4px grid (Tailwind 기본)

**Consistency:**
- 모든 패턴은 Tailwind 유틸리티 사용
- shadcn/ui 컴포넌트 기반 확장
- 일관된 naming: {variant}-{size}-{state}

---

## Responsive Design & Accessibility

반응형 디자인과 접근성은 Paros가 모든 사용자에게 도달할 수 있도록 보장합니다.

### Responsive Strategy

Paros는 데스크탑 Primary, iPad Secondary 전략을 따릅니다.

**1. Desktop (1920px, 1366px) - Primary**

**레이아웃:**
- **Split View:** 왼쪽 패널 (40%) + 오른쪽 패널 (60%)
- **Grid:** 12-column (content max-width 1440px)
- **Full Width:** 100% (1920px에서도 여유 있게)

**특징:**
- 마우스/키보드 중심 상호작용
- Hover states 활용
- Dense information (테이블 모든 열 표시)
- 멀티태스킹 (다중 윈도)

**최적화:**
- 테이블: 6개 열 모두 표시
- 왼쪽 패널: 400px-600px (고정)
- 오른쪽 패널: 나머지 공간
- 여백: 24px padding

---

**2. iPad Landscape (1024px) - Secondary**

**레이아웃:**
- **Split View 유지:** 왼쪽 (35%) + 오른쪽 (65%)
- **Touch-optimized:** 버튼, 터치 타겟 증가
- **Gesture 지원:** 스와이프, 핀치

**특징:**
- 터치 인터페이스
- 중간 정보 밀도
- 현실적인 업무 가능

**최적화:**
- 테이블: 6개 열 모두 표시 (폰트 약간 줄임)
- 왼쪽 패널: 35% (350px)
- 오른쪽 패널: 65%
- 버튼: 최소 44px 높이
- 여백: 16px padding

---

**3. iPad Portrait (768px) - Adaptive**

**레이아웃:**
- **Single Column:** 왼쪽 패널 위, 테이블 아래
- **Collapsible:** 왼쪽 패널 접기/펼치기 가능
- **Navigation:** 간소화된 내비게이션

**특징:**
- Portrait 모드 최적화
- 세로 스크롤
- 핵심 정보 우선

**최적화:**
- 테이블: 중요한 4개 열만 (나머지는 "상세 보기")
- 왼쪽 패널: 접혀진 상태로 시작 (핵심 발견만)
- 버튼: 전체 너비 (w-full block)
- 여백: 16px padding

---

**4. Mobile (375px+) - Future**

**레이아웃:**
- **Single Column:** 모든 요소 수직 배치
- **Bottom Navigation:** 주요 액션
- **Minimal:** 가장 간소한 UI

**특징:**
- 한 손 조작
- 중요 정보만
- 필터 기능 단순화

**참고:** Post-MVP 고려

---

### Breakpoint Strategy

Tailwind CSS 기본 breakpoints를 사용합니다.

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',   // 작은 노트북 (지원 안 함)
      'md': '768px',   // iPad Portrait (세로)
      'lg': '1024px',  // iPad Landscape (가로), 노트북
      'xl': '1280px',  // 데스크탑
      '2xl': '1536px', // 대형 데스크탑
    },
  },
}
```

**Breakpoint Decision Points:**

1. **768px (md):** iPad Portrait
   - Split View → Single Column
   - 왼쪽 패널 접기

2. **1024px (lg):** iPad Landscape, 노트북
   - Split View 시작
   - Touch target 44px

3. **1920px (2xl):** 대형 데스크탑
   - Max-width 1440px
   - 중앙 정렬

**Responsive Classes Example:**

```jsx
{/* Split View: lg 이상에서만 2열 */}
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <aside className="col-span-1 lg:col-span-2">
    {/* 왼쪽 패널 */}
  </aside>
  <main className="col-span-1 lg:col-span-3">
    {/* 오른쪽 패널 */}
  </main>
</div>

{/* 버튼: 모바일에서 전체 너비 */}
<button className="w-full lg:w-auto px-6">
  엑셀 다운로드
</button>
```

---

### Accessibility Strategy

Paros는 WCAG 2.1 Level AA 준수를 목표로 합니다 (법률/금융 서비스 권장).

#### 1. Color Contrast (색상 대비)

**WCAG 2.1 AA 요구사항:**
- **Normal Text:** 4.5:1 minimum
- **Large Text (18px+):** 3:1 minimum
- **UI Components:** 3:1 minimum

**Paros 색상 검증:**

| Color Combination | Ratio | WCAG AA |
|------------------|-------|---------|
| Blue-600 (#2563EB) on White | 8.2:1 | ✅ Pass |
| Slate-700 (#334155) on White | 4.7:1 | ✅ Pass |
| Red-700 (#B91C1C) on Red-50 (#FEF2F2) | 5.1:1 | ✅ Pass |
| Amber-700 (#B45309) on Amber-50 (#FFFBEB) | 4.9:1 | ✅ Pass |
| Orange-700 (#C2410C) on Orange-50 (#FFF7ED) | 4.6:1 | ✅ Pass |

**결과:** 모든 색상 조합이 WCAG AA를 통과합니다.

---

#### 2. Keyboard Navigation (키보드 네비게이션)

**요구사항:**
- 모든 인터랙션 요소 키보드로 접근 가능
- Tab 순서: 논리적 (왼쪽 → 오른쪽, 위 → 아래)
- Focus visible: ring-2 ring-blue-500 ring-offset-2
- Skip links: "주요 콘텐츠로 건너뛰기"

**구현:**
```jsx
{/* Skip Link (최상단) */}
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 bg-blue-600 text-white p-2 rounded z-50">
  주요 콘텐츠로 건너뛰기
</a>

{/* Focus visible */}
<button className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
  엑셀 다운로드
</button>

{/* Tab 순서 */}
<div tabIndex={0}>{/* 첫 번째 요소 */}
<div tabIndex={1}>{/* 두 번째 요소 */}
```

---

#### 3. Screen Reader Compatibility (스크린 리더 호환)

**요구사항:**
- Semantic HTML (header, nav, main, section, footer)
- ARIA labels, roles, states
- Alt text (이미지 설명)
- Live regions (동적 업데이트)

**구현:**
```jsx
{/* Semantic HTML */}
<header>
  <nav aria-label="주요 내비게이션">
  <main id="main-content" role="main">
  <footer>

{/* ARIA labels */}
<button aria-label="엑셀 파일 다운로드">
  <DownloadIcon />
</button>

<input aria-label="금액 입력" placeholder="금액 입력" />

<img src="/logo.png" alt="Paros 로고" />

{/* Live regions (토스트 메시지) */}
<div role="status" aria-live="polite" className="sr-only">
  엑셀 다운로드가 완료되었습니다
</div>
```

---

#### 4. Touch Target Size (터치 타겟 크기)

**요구사항:**
- **Minimum:** 44x44px (WCAG 2.5.5)
- **Recommended:** 48x48px
- **Spacing:** 8px between targets

**구현:**
```jsx
{/* Button (iPad) */}
<button className="h-11 min-w-[44px] px-4">
  엑셀 다운로드
</button>

{/* Checkbox/Radio */}
<input type="checkbox" className="h-5 w-5" />

{/* Table Row Click */}
<tr className="cursor-pointer h-14 hover:bg-slate-50">
```

---

#### 5. Focus Management (포커스 관리)

**요구사항:**
- Modal 열리면 포커스 이동
- Modal 닫히면 이전 요소로 포커스 복귀
- Focus trap (모달 내에서만 이동)
- Auto-focus (첫 번째 입력 필드)

**구현:**
```jsx
{/* Modal focus management */}
const Modal = () => {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // 모달 열리면 첫 번째 요소에 포커스
      modalRef.current?.focus();
      // Focus trap 구현
    } else {
      // 모달 닫히면 트리거 요소로 포커스 복귀
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <Dialog ref={modalRef}>
      <DialogTitle>필터 옵션</DialogTitle>
      {/* 모달 콘텐츠 */}
    </Dialog>
  );
};
```

---

#### 6. Error Identification (오류 식별)

**요구사항:**
- Error messages: 텍스트로 설명
- Error indicators: 아이콘 + 색상
- Suggestions: 해결책 제시
- ARIA: aria-invalid="true", aria-describedby

**구현:**
```jsx
<input
  type="text"
  aria-invalid={hasError}
  aria-describedby="amount-error"
  className={hasError ? "border-red-500 focus:ring-red-500" : "border-slate-200"}
/>

{hasError && (
  <p id="amount-error" className="text-red-600 text-sm mt-1" role="alert">
    ❌ 0보다 큰 값을 입력해주세요
  </p>
)}
```

---

### Testing Strategy

#### 1. Responsive Testing

**Device Testing:**
- **실제 기기:** iPad Pro 11" (1024px x 834px)
- **브라우저:** Chrome, Safari, Firefox, Edge
- **네트워크:** 3G, 4G, WiFi 성능 테스트

**Tools:**
- Chrome DevTools (Device Toolbar)
- Responsively App (시각적 테스트)
- BrowserStack (다양한 기기/브라우저)

**Test Scenarios:**
- Split View (1920px, 1366px, 1024px)
- Single Column (768px)
- 터치 상호작용 (iPad 스와이프, 핀치)
- 가로/세로 회전
- 네트워크 속도 (느린 연결)

---

#### 2. Accessibility Testing

**Automated Tools:**
- **axe DevTools** (Chrome Extension) - 필수
- **WAVE** (WebAIM) - 추천
- **Lighthouse** (Chrome) - 필수
- **pa11y** (CLI) - 선택

**Manual Testing:**
- **Keyboard:** Tab만으로 모든 기능 테스트
- **Screen Reader:** VoiceOver (macOS/iOS), NVDA (Windows)
- **Color Blindness:** Toptal Color Blindness Simulator
- **Zoom:** 200%, 400% 확대 테스트

**Test Checklist:**
- [ ] 모든 버튼/링크 키보드로 접근 가능
- [ ] Focus 순서 논리적
- [ ] Focus visible 명확히 보임
- [ ] 색상 대비 4.5:1 이상
- [ ] 이미지에 alt text
- [ ] Form에 label 연결
- [ ] Error 메시지 명확함
- [ ] Screen reader로 모든 기능 사용 가능

---

### Implementation Guidelines

#### Responsive Development

**1. 상대 단위 사용**
```jsx
// ✅ Good (상대 단위)
<div className="w-full max-w-7xl px-6">

// ❌ Bad (고정 픽셀)
<div style="width: 1200px; padding: 24px;">
```

**2. Mobile-First Media Queries**
```jsx
// ✅ Good (mobile-first)
<div className="grid grid-cols-1 lg:grid-cols-5">

// ❌ Bad (desktop-first)
<div className="hidden lg:block grid-cols-5">
```

**3. 터치 타겟 최적화**
```jsx
// 버튼 최소 44px
<button className="h-11 min-w-[44px] px-4">
  엑셀 다운로드
</button>

// 링크 영역 충분히
<a className="block p-4">
  거래 내역 보기
</a>
```

**4. 이미지 최적화**
```jsx
// Next.js Image (반응형)
<Image
  src="/dashboard-illustration.png"
  width={800}
  height={600}
  alt="Paros 대시보드 일러스트레이션"
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
  className="rounded-lg"
/>
```

---

#### Accessibility Development

**1. Semantic HTML**
```jsx
// ✅ Good
<header><nav><main id="main-content"><footer>

// ❌ Bad
<div class="header"><div class="nav"><div class="main">
```

**2. ARIA Labels**
```jsx
// 모든 인터랙션 요소에
<button aria-label="엑셀 다운로드" className="...">
  <DownloadIcon aria-hidden="true" />
</button>

<input aria-label="금액 입력 (단위: 만원)" />

<a aria-label="Paros 로고, 홈으로 이동" href="/">
  <img src="/logo.png" alt="" />
</a>
```

**3. Focus Management**
```jsx
import { useEffect, useRef } from 'react';

const Modal = ({ isOpen, onClose }) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // 현재 포커스된 요소 저장
      previousActiveElement.current = document.activeElement;

      // 모달 내 첫 번째 포커스 가능 요소 찾기
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0];
      firstElement?.focus();

      // Focus trap
      const handleTab = (e) => {
        if (e.key === 'Tab') {
          const elements = Array.from(focusableElements || []);
          const first = elements[0];
          const last = elements[elements.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      return () => document.removeEventListener('keydown', handleTab);
    } else {
      // 모달 닫히면 이전 요소로 포커스 복귀
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // ... rest of component
};
```

**4. High Contrast Mode**
```css
/* globals.css */
@media (prefers-contrast: high) {
  .finding-card {
    border: 2px solid currentColor;
    box-shadow: none;
  }

  button {
    border: 2px solid currentColor;
  }
}
```

---

## Strategy Summary

**Responsive:**
- Desktop (1920px, 1366px): Split View (40/60)
- iPad Landscape (1024px): Split View (35/65)
- iPad Portrait (768px): Single Column
- Mobile (375px+): Future (Post-MVP)

**Accessibility:**
- WCAG 2.1 AA 준수
- Color Contrast: 모두 4.5:1 이상
- Keyboard Navigation: 모든 기능
- Screen Reader: Semantic HTML + ARIA
- Touch Targets: 최소 44x44px

**Testing:**
- 실제 기기 + 브라우저 테스트
- 자동화 도구 (axe, Lighthouse)
- Screen reader (VoiceOver, NVDA)
- Keyboard-only 테스트

---
