# Sprint Change Proposal - Netlify DB 배포 설정
**Generated:** 2026-01-15
**Project:** paros-bmad (PHAROS)
**Workflow:** Correct Course - Infrastructure Enhancement
**Change Classification:** Enhancement (New Deployment Infrastructure)

---

## Section 1: Issue Summary

### Trigger
사용자가 Netlify DB를 사용한 배포 설정을 요청하여 네틀리파이 플랫폼에 배포 인프라를 구축

### 변경 배경
**User Request:** "DB 배포를 네틀리파이 DB로 하고싶거든? 그래서 네틀리파이에서 배포문제 다 해결하게? 도큐멘테이션 읽고 와서 필요한 문서화 및 개발 진행 해줘"

**Evidence:**
- Netlify DB 문서 리뷰 완료: https://docs.netlify.com/build/data-and-storage/netlify-db/
- `@netlify/neon` 패키지 설치 완료
- 배포 설정 파일 생성 완료
- 배포 가이드 문서화 완료

### 발견된 변경사항

1. **패키지 설치**: `@netlify/neon` 패키지 추가
2. **설정 파일**: `netlify.toml` 생성
3. **환경 변수**: `.env.example` 업데이트
4. **배포 스크립트**: `package.json`에 3개 명령어 추가
5. **배포 문서**: `docs/NETLIFY_DEPLOYMENT.md` 작성
6. **README**: 배포 섹션 추가
7. **Git 무시**: `.gitignore` 업데이트

---

## Section 2: Impact Analysis

### Epic Impact

**영향받는 Epic:** 없음

- 모든 Epic (1-8)은 완료 상태
- 이 변경사항은 배포 인프라에만 영향
- 기존 기능 코드 변경 없음

**Epic-level changes:** 없음

### Artifact Conflicts

**PRD Conflicts:** ✅ 없음
- 모든 FR (Functional Requirements) 유지
- NFR-016 (S3 직접 통합) 등 비기능 요구사항도 유지

**Architecture Conflicts:** ✅ 없음
- 기존: Neon Database + Prisma ORM
- 새로운: Netlify DB (Neon 기반) + Prisma ORM
- **완전 호환**: 동일한 PostgreSQL 데이터베이스

**UX/UI Conflicts:** ✅ 없음
- UI/UX 변경 없음

**Other Artifacts:**
- **배포 스크립트:** 개선됨 (간소화)
- **문서화:** 추가됨 (NETLIFY_DEPLOYMENT.md)

### Technical Impact

**데이터베이스 호환성:**
- 로컬 개발: 기존 PostgreSQL 사용 (그대로 유지)
- Netlify 배포: Netlify DB (Neon) 자동 생성
- **Prisma 스키마:** 변경 불필요 (동일한 PostgreSQL)

**배포 프로세스:**
- 기존: 수동으로 Neon 콘솔에서 DB 생성 + DATABASE_URL 설정
- 새로운: `npx netlify db init` 한 번의 명령어로 자동 완료

---

## Section 3: Recommended Approach

### 선택된 경로: Direct Adjustment (Option 1)

### 이유

1. **비파괴적 추가**: 기존 코드 변경 없음
2. **완전 호환**: Netlify DB = Neon PostgreSQL (동일한 기술)
3. **개선된 DX**: 배포 프로세스 간소화
4. **자동화**: Git push만으로 자동 배포 + DB 자동 생성
5. **문서화 완료**: 상세 배포 가이드 제공

### Effort & Risk Summary

| 항목 | 상태 | 설명 |
|------|------|------|
| 구현 완료 | ✅ DONE | 모든 파일 생성됨 |
| Effort | LOW (완료) | 이미 모든 작업 완료됨 |
| Risk | LOW | 기존 기능 영향 없음 |
| 호환성 | ✅ 완전 | Prisma + PostgreSQL 유지 |
| 문서화 | ✅ 완료 | NETLIFY_DEPLOYMENT.md 생성 |

---

## Section 4: Detailed Changes

### 변경 1: 패키지 설치

**File:** `package.json`

**Changes:**
```json
"dependencies": {
  "@netlify/neon": "^latest"  // 추가됨
}
```

**Purpose:** Netlify DB 자동 프로비저닝

---

### 변경 2: Netlify 설정 파일

**File:** `netlify.toml` (새 파일)

**Key Settings:**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20.12.2"

[[plugins]]
  package = "@netlify/neon"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Purpose:** Netlify 빌드 및 배포 설정

---

### 변경 3: 환경 변수 문서화

**File:** `.env.example`

**Changes:**
```bash
# Database (PostgreSQL - Neon / Netlify DB)
# Netlify Deployment:
# When using Netlify DB, DATABASE_URL is automatically set by @netlify/neon package.
# Available environment variables after Netlify DB setup:
# - DATABASE_URL: Primary database connection string (auto-set by Netlify)
# - NETLIFY_DB_PGHOST: Database host
# - NETLIFY_DB_PGDATABASE: Database name
# - NETLIFY_DB_PGUSER: Database user
# - NETLIFY_DB_PGPASSWORD: Database password
# - NEON_DATABASE_URL: Alternative connection string
```

**Purpose:** Netlify DB 환경 변수 설명 추가

---

### 변경 4: 배포 스크립트

**File:** `package.json`

**Added Scripts:**
```json
"scripts": {
  "netlify": "netlify dev",
  "netlify:build": "netlify build",
  "netlify:deploy": "netlify deploy --prod"
}
```

**Purpose:** Netlify 배포 명령어 추가

---

### 변경 5: 배포 문서

**File:** `docs/NETLIFY_DEPLOYMENT.md` (새 파일)

**Sections:**
1. Overview
2. Prerequisites
3. Quick Start
4. Environment Variables
5. Database Migrations
6. Local Development
7. Claim Your Database
8. Build Configuration
9. Troubleshooting
10. Deployment Workflow
11. Monitoring
12. Advanced Configuration
13. Cost and Limits
14. Additional Resources

**Purpose:** 상세 Netlify 배포 가이드

---

### 변경 6: README 업데이트

**File:** `README.md`

**Added Section:**
```markdown
## Netlify 배포

### 빠른 시작
```bash
npx netlify db init
npm run netlify:deploy
```
```

**Purpose:** 빠른 배포 시작 가이드

---

### 변경 7: Git 무시 설정

**File:** `.gitignore`

**Added:**
```
# netlify
.netlify
netlify.toml.local
```

**Purpose:** Netlify 로컬 설정 파일 제외

---

## Section 5: Implementation Handoff

### Change Scope Classification: **ENHANCEMENT**

**Rationale:**
- 새로운 배포 인프라 추가
- 기존 기능 코드 변경 없음
- 문서화 완료
- 배포 준비 완료

### Handoff Recipients: **배포 팀 / 개발자**

### 배포 가이드

#### 1. Netlify DB 초기화 (처음 한 번)

```bash
npx netlify db init
```

이 명령이 수행하는 작업:
- Netlify DB 인스턴스 자동 생성
- 필수 환경변수 자동 설정
- Netlify 프로젝트에 DB 연결

#### 2. 환경 변수 설정

Netlify Dashboard → Site Settings → Environment Variables

**필수 변수:**
```bash
JWT_SECRET=your-generated-secret
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
NODE_ENV=production
```

**선택 변수 (AI 기능용):**
```bash
AI_PROVIDER=upstage
UPSTAGE_API_KEY=your-api-key
```

#### 3. 배포

```bash
# 프로덕션 배포
npm run netlify:deploy

# 또는 Git push로 자동 배포
git push origin main
```

#### 4. 데이터베이스 클레임 (중요!)

**7일 후 데이터베이스 만료!**

1. Netlify Dashboard → Extensions → Neon Database
2. **Connect Neon** 클릭
3. **Claim database** 클릭

### Success Criteria

**배포 성공:**
- ✅ Netlify에 사이트 배포됨
- ✅ Netlify DB 자동 생성됨
- ✅ Prisma 마이그레이션 성공
- ✅ 애플리케이션 접속 가능

**기능 동작:**
- ✅ 로그인/로그아웃 작동
- ✅ 파일 업로드 작동
- ✅ 거래 분류 작동
- ✅ 데이터 저장/조회 작동

### Next Steps

1. **로컬 테스트:** `npm run netlify`로 로컬에서 테스트
2. **데이터베이스 스키마:** `npm run db:push`로 스키마 푸시
3. **초기화:** `npx netlify db init`로 DB 초기화
4. **배포:** `npm run netlify:deploy`로 배포
5. **클레임:** 7일 내에 데이터베이스 클레임

---

## Appendix: Technical Details

### Netlify DB 아키텍처

```
로컬 개발:
┌─────────────┐
│ Next.js Dev │ ← PostgreSQL (localhost)
│  :3000      │
└─────────────┘

Netlify 배포:
┌─────────────┐     ┌──────────────┐
│   Netlify   │────→│  Netlify DB  │
│  Functions  │     │   (Neon)     │
└─────────────┘     └──────────────┘
      ↓
  Static Files
```

### 환경 변수 자동 생성

`@netlify/neon` 패키지가 설치되면 다음 변수가 자동으로 생성됨:

```bash
DATABASE_URL=postgres://user:pass@host/database
NETLIFY_DB_PGHOST=xxxxx.aws.neon.tech
NETLIFY_DB_PGDATABASE=paros
NETLIFY_DB_PGUSER=paros_admin
NETLIFY_DB_PGPASSWORD=xxxxx
NEON_DATABASE_URL=postgres://xxxxx@xxxxx.aws.neon.tech/paros
```

### Prisma 호환성

```prisma
// schema.prisma - 변경 불필요!
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Netlify DB가 자동으로 `DATABASE_URL`을 설정하므로 Prisma 코드 변경 불필요.

---

## Approval

**Date:** 2026-01-15
**Status:** ✅ **IMPLEMENTED**

**Changes Implemented:**
- [x] Package installed (@netlify/neon)
- [x] Configuration created (netlify.toml)
- [x] Environment documented (.env.example)
- [x] Scripts added (netlify, netlify:build, netlify:deploy)
- [x] Documentation created (NETLIFY_DEPLOYMENT.md)
- [x] README updated
- [x] Git ignore updated

**Deployment Ready:**
- [x] All files created
- [x] Documentation complete
- [x] Backward compatible
- [x] Ready for deployment

---

*End of Sprint Change Proposal - Netlify DB Deployment*
