# paros BMAD

**Business Money Analysis & Detection** - 법률 사건 금융 거래 분석 플랫폼

## 개요

paros BMAD는 변호사와 법률 사무소를 위한 AI 기반 금융 거래 분석 시스템입니다. 엑셀, CSV, PDF 파일에서 거래 내역을 자동으로 추출하고 분류하여 사건 분석을 효율화합니다.

### 주요 기능

- 📁 **파일 분석**: Excel, CSV, PDF 지원
- 🤖 **AI 자동 분류**: 거래 내역을 카테고리별 자동 분류 (Story 4.1)
- 📊 **시각화**: 거래 패턴 분석 및 리포트 생성
- 🔐 **역할 기반 접근 제어**: Case Lawyer, Admin 권한 관리

## 기술 스택

- **Framework**: [Next.js 15](https://nextjs.org) (Pages Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/)
- **Deployment**: [Netlify](https://www.netlify.com/) + [Netlify DB (Neon)](https://docs.netlify.com/build/data-and-storage/netlify-db/)
- **API**: [tRPC](https://trpc.io/) (타입 안전한 API)
- **Authentication**: JWT (Custom implementation)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Testing**: [Vitest](https://vitest.dev/) + Testing Library
- **AI Providers**: Upstage Solar, OpenAI GPT, Anthropic Claude

## 시작하기

### 사전 요구사항

- Node.js 18+
- PostgreSQL 데이터베이스
- npm 또는 yarn

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env

# 데이터베이스 설정
# .env 파일의 DATABASE_URL을 본인의 데이터베이스로 변경

# 데이터베이스 마이그레이션
npx prisma migrate deploy

# Prisma Client 생성
npx prisma generate

# 개발 서버 시작
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 애플리케이션을 확인하세요.

## 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 설정하세요.

### 필수 환경 변수

```bash
# 데이터베이스
DATABASE_URL="postgresql://user:password@hostname:5432/database?schema=public"

# JWT 인증
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"

# 애플리케이션
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### AI 분류 설정 (Story 4.1)

AI 기반 거래 자동 분류 기능을 사용하려면 AI 공급자 설정이 필요합니다.

```bash
# AI 공급자 선택 (upstage, openai, anthropic)
AI_PROVIDER="upstage"

# Upstage Solar API (한국어 최적화)
UPSTAGE_API_KEY="your-upstage-api-key"

# OpenAI GPT API
OPENAI_API_KEY="your-openai-api-key"

# Anthropic Claude API
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

#### AI 공급자별 특징

| 공급자 | 장점 | 용도 | API 키 발급 |
|--------|------|------|-------------|
| **Upstage Solar** | 한국어 최적화, 빠른 응답 | 한국 거래 분류 (추천) | [console.upstage.ai](https://console.upstage.ai) |
| **OpenAI GPT** | 다국어 지원, 높은 정확도 | 복잡한 분류 | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic Claude** | 긴 컨텍스트 창 | 대량 거래 분류 | [console.anthropic.com](https://console.anthropic.com) |

## Netlify 배포

### 빠른 시작

Netlify DB (Neon PostgreSQL)를 사용하여 한 번의 명령어로 배포할 수 있습니다.

```bash
# 1. Netlify DB 초기화
npx netlify db init

# 2. Netlify에 배포
npm run netlify:deploy
```

자세한 내용은 [Netlify Deployment Guide](docs/NETLIFY_DEPLOYMENT.md)를 참조하세요.

### 주요 기능

- **자동 데이터베이스 프로비저닝**: `@netlify/neon` 패키지로 자동 DB 생성
- **환경 변수 자동 설정**: DATABASE_URL 등 필수 변수 자동 구성
- **무료 7일 체험**: 데이터베이스 클레임 후 생산 사용 가능
- **간단한 배포**: Git push만으로 자동 배포

### 배포 스크립트

```bash
# 로컬 개발 (Netlify Dev)
npm run netlify

# 빌드
npm run netlify:build

# 프로덕션 배포
npm run netlify:deploy
```

## 데이터베이스 마이그레이션

### 스키마 변경 시

Prisma 스키마(`prisma/schema.prisma`)를 수정한 후에는 반드시 다음 명령어를 실행하세요:

```bash
# 개발 환경: 스키마를 DB에 즉시 반영 (데이터 손실 가능)
npx prisma db push

# 프로덕션 환경: 마이그레이션 파일 생성 후 적용
npx prisma migrate dev --name [마이그레이션_이름]
npx prisma migrate deploy
```

> ⚠️ **주의**: `git pull` 후 새로운 모델이 추가된 경우, `npm install` 후 반드시 `npx prisma db push`를 실행해야 합니다.

## 개발

### 사용 가능한 스크립트

```bash
# 개발 서버 (Turbo)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 시작
npm start

# 타입 검사
npm run typecheck

# 린트
npm run lint
npm run lint:fix

# 테스트
npm run test          # watch 모드
npm run test:run      # 단일 실행
npm run test:coverage # 커버리지 리포트

# 데이터베이스
npm run db:generate   # 마이그레이션 생성
npm run db:migrate    # 마이그레이션 적용
npm run db:push       # 스키마 푸시 (개발용)
npm run db:studio     # Prisma Studio
```

### 프로젝트 구조

```
paros-bmad/
├── prisma/
│   └── schema.prisma          # 데이터베이스 스키마
├── public/                    # 정적 파일
├── src/
│   ├── app/                   # Next.js App Router
│   ├── components/            # React 컴포넌트
│   ├── server/
│   │   ├── api/
│   │   │   └── routers/       # tRPC 라우터
│   │   ├── ai/                # AI 분류 서비스 (Story 4.1)
│   │   │   ├── providers/     # AI 공급자
│   │   │   └── types.ts       # 타입 정의
│   │   └── db.ts              # Prisma Client
│   └── utils/                 # 유틸리티 함수
├── test.setup.ts              # 테스트 설정
└── vitest.config.ts           # Vitest 설정
```

## 테스트

Story 4.1 (AI 분류)의 테스트 커버리지:

```bash
# 전체 테스트 실행
npm run test:run

# 커버리지 리포트
npm run test:coverage
```

**현재 테스트 현황**:
- Classification Service: 71.01% 커버리지
- AI Button Component: 68.42% 커버리지
- 총 21개 테스트 통과 ✅

## 배포

### Vercel (추천)

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

### Docker

```bash
# Docker 이미지 빌드
docker build -t paros-bmad .

# 컨테이너 실행
docker run -p 3000:3000 --env-file .env paros-bmad
```

## 라이선스

본 프로젝트는 상업적 목적으로 사용됩니다.

---

**paros BMAD** - 법률 사건 분석의 새로운 기준
