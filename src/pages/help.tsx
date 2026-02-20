import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "~/contexts/AuthContext";
import { ThemeToggleButton } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import {
  BookOpen,
  LogIn,
  UserPlus,
  LayoutDashboard,
  FolderOpen,
  FileUp,
  MessageSquare,
  Search,
  Download,
  StickyNote,
  User,
  Shield,
  Settings,
  FileSpreadsheet,
  Database,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  Eye,
  Filter,
  Edit,
  Trash2,
  Copy,
  Plus,
  Lock,
  Mail,
  Menu,
  X,
} from "lucide-react";

/* ───────────── 사이드바 메뉴 구조 ───────────── */
interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
}

const userGuideMenu: MenuItem[] = [
  {
    id: "getting-started",
    label: "시작하기",
    icon: <BookOpen className="h-4 w-4" />,
    children: [
      { id: "overview", label: "서비스 소개" },
      { id: "register", label: "회원가입" },
      { id: "login", label: "로그인" },
      { id: "forgot-password", label: "비밀번호 찾기" },
    ],
  },
  {
    id: "dashboard",
    label: "대시보드",
    icon: <LayoutDashboard className="h-4 w-4" />,
    children: [
      { id: "dashboard-overview", label: "대시보드 개요" },
      { id: "navigation", label: "메뉴 구조 안내" },
    ],
  },
  {
    id: "cases",
    label: "사건 관리",
    icon: <FolderOpen className="h-4 w-4" />,
    children: [
      { id: "case-create", label: "새 사건 등록" },
      { id: "case-list", label: "사건 목록 조회" },
      { id: "case-detail", label: "사건 상세 보기" },
      { id: "case-edit", label: "사건 정보 수정" },
      { id: "case-archive", label: "사건 아카이브" },
    ],
  },
  {
    id: "transactions",
    label: "거래내역 분석",
    icon: <FileUp className="h-4 w-4" />,
    children: [
      { id: "file-upload", label: "파일 업로드" },
      { id: "transaction-table", label: "거래내역 테이블" },
      { id: "transaction-filter", label: "파일별 필터링" },
      { id: "transaction-delete", label: "거래내역 삭제" },
    ],
  },
  {
    id: "ai-assistant",
    label: "AI 어시스턴트",
    icon: <MessageSquare className="h-4 w-4" />,
    children: [
      { id: "ai-chat", label: "AI 채팅 사용법" },
      { id: "loan-tracking", label: "대출금 소명자료 생성" },
      { id: "amount-filter", label: "금액 이상 입출금건" },
    ],
  },
  {
    id: "findings",
    label: "발견사항",
    icon: <AlertTriangle className="h-4 w-4" />,
    children: [
      { id: "findings-list", label: "발견사항 목록" },
      { id: "findings-detail", label: "발견사항 상세" },
      { id: "findings-notes", label: "발견사항 메모" },
    ],
  },
  {
    id: "export",
    label: "내보내기",
    icon: <Download className="h-4 w-4" />,
    children: [
      { id: "export-full", label: "전체 내보내기" },
      { id: "export-selected", label: "선택 내보내기" },
      { id: "export-findings", label: "발견사항 내보내기" },
    ],
  },
  {
    id: "case-notes",
    label: "사건 메모",
    icon: <StickyNote className="h-4 w-4" />,
    children: [
      { id: "note-create", label: "메모 추가" },
      { id: "note-edit", label: "메모 수정/삭제" },
    ],
  },
  {
    id: "profile",
    label: "프로필 관리",
    icon: <User className="h-4 w-4" />,
    children: [
      { id: "profile-view", label: "프로필 조회" },
      { id: "profile-name", label: "이름 변경" },
      { id: "profile-email", label: "이메일 변경" },
      { id: "profile-password", label: "비밀번호 변경" },
    ],
  },
];

const adminGuideMenu: MenuItem[] = [
  {
    id: "admin-overview",
    label: "관리자 개요",
    icon: <Shield className="h-4 w-4" />,
    children: [
      { id: "admin-intro", label: "관리자 권한 안내" },
      { id: "admin-access", label: "관리자 메뉴 접근" },
    ],
  },
  {
    id: "ai-settings",
    label: "AI 설정",
    icon: <Sparkles className="h-4 w-4" />,
    children: [
      { id: "ai-provider", label: "AI 제공자 설정" },
      { id: "ai-keys", label: "API 키 관리" },
    ],
  },
  {
    id: "s3-settings",
    label: "S3 저장소 설정",
    icon: <Database className="h-4 w-4" />,
    children: [
      { id: "s3-config", label: "AWS S3 설정" },
    ],
  },
  {
    id: "template-management",
    label: "템플릿 관리",
    icon: <FileSpreadsheet className="h-4 w-4" />,
    children: [
      { id: "template-overview", label: "템플릿 개요" },
      { id: "template-create", label: "새 템플릿 생성" },
      { id: "template-ai-analyze", label: "AI 자동 분석" },
      { id: "template-column", label: "컬럼 매핑 설정" },
      { id: "template-edit", label: "템플릿 수정/삭제" },
      { id: "template-test", label: "매칭 테스트" },
    ],
  },
];

/* ───────────── 도움말 콘텐츠 ───────────── */
function GuideContent({ sectionId }: { sectionId: string }) {
  const sections: Record<string, React.ReactNode> = {
    /* ===== 시작하기 ===== */
    overview: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="help-section-title">서비스 소개</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
          <p className="text-blue-800 dark:text-blue-200 font-medium text-lg mb-2">법무법인 파로스 - 파산 사건 분석 시스템</p>
          <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
            본 시스템은 파산 사건 처리를 위한 전문 분석 도구입니다. 거래내역서를 업로드하면 AI가 자동으로
            분석하여 이상 거래를 탐지하고, 법률 전문가의 업무 효율을 극대화합니다.
          </p>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">주요 기능</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: "사건 관리", desc: "파산 사건을 등록하고, 상태를 추적하며, 관련 정보를 체계적으로 관리합니다." },
            { title: "거래내역 분석", desc: "엑셀, CSV, PDF 형식의 거래내역서를 업로드하면 AI가 자동으로 파싱하고 분류합니다." },
            { title: "AI 어시스턴트", desc: "거래내역에 대한 질문을 AI에게 물어볼 수 있으며, 대출금 소명자료 생성 등 전문 기능을 제공합니다." },
            { title: "발견사항 관리", desc: "AI가 감지한 이상 거래, 중요 패턴 등을 발견사항으로 관리하고 메모를 추가할 수 있습니다." },
            { title: "내보내기", desc: "거래내역, 발견사항을 엑셀 파일로 내보내어 보고서 작성에 활용할 수 있습니다." },
            { title: "템플릿 시스템", desc: "은행별 거래내역서 형식을 템플릿으로 정의하여 파싱 정확도를 높입니다." },
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{item.title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">사용자 역할</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">역할</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">설명</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">주요 권한</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">변호사 (LAWYER)</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">파산 사건 담당 변호사</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">사건 등록/조회/수정, 거래내역 업로드/분석, AI 어시스턴트 사용</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">법무사 (PARALEGAL)</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">법무사 지원 인력</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">사건 조회, 거래내역 확인, 보조 업무</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">관리자 (ADMIN)</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">시스템 관리자</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">모든 권한 + AI 설정, 템플릿 관리, S3 설정</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">지원팀 (SUPPORT)</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">기술 지원 인력</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">제한된 조회 권한</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),

    register: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">회원가입</h2>
        <p className="text-gray-600 dark:text-gray-400">
          서비스를 이용하려면 먼저 회원가입을 해야 합니다. 가입 후 이메일 인증을 완료해야 로그인이 가능합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="회원가입 페이지 접근">
            <p>로그인 페이지 하단의 <InlineCode>회원가입</InlineCode> 링크를 클릭하여 회원가입 페이지로 이동합니다.</p>
          </Step>
          <Step number={2} title="정보 입력">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>이메일</strong>: 유효한 이메일 주소를 입력합니다. (예: example@lawfirm.com)</li>
              <li><strong>비밀번호</strong>: 8자 이상의 비밀번호를 입력합니다.</li>
              <li><strong>비밀번호 확인</strong>: 동일한 비밀번호를 다시 입력합니다.</li>
            </ul>
          </Step>
          <Step number={3} title="가입하기 버튼 클릭">
            <p>모든 정보를 입력한 후 <InlineCode>가입하기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={4} title="이메일 인증">
            <p>입력한 이메일로 인증 링크가 발송됩니다. 이메일을 확인하고 인증 링크를 클릭하여 계정을 활성화하세요.</p>
          </Step>
        </div>
        <InfoBox type="warning" title="유의사항">
          <ul className="list-disc list-inside space-y-1">
            <li>이메일 인증을 완료하지 않으면 로그인이 불가합니다.</li>
            <li>인증 메일이 도착하지 않는 경우 스팸함을 확인해주세요.</li>
            <li>비밀번호는 반드시 8자 이상이어야 합니다.</li>
          </ul>
        </InfoBox>
      </div>
    ),

    login: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">로그인</h2>
        <p className="text-gray-600 dark:text-gray-400">
          회원가입과 이메일 인증을 완료한 후, 아래 절차에 따라 로그인합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="로그인 페이지 접근">
            <p>웹 브라우저에서 서비스 주소에 접속하면 자동으로 로그인 페이지로 이동합니다.</p>
          </Step>
          <Step number={2} title="인증 정보 입력">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>이메일</strong>: 가입 시 사용한 이메일 주소를 입력합니다.</li>
              <li><strong>비밀번호</strong>: 가입 시 설정한 비밀번호를 입력합니다.</li>
            </ul>
          </Step>
          <Step number={3} title="로그인 버튼 클릭">
            <p><InlineCode>로그인</InlineCode> 버튼을 클릭하면 대시보드로 이동합니다.</p>
          </Step>
        </div>
        <InfoBox type="info" title="참고">
          <ul className="list-disc list-inside space-y-1">
            <li>로그인 상태는 브라우저 세션이 유지되는 동안 지속됩니다.</li>
            <li>새 탭/창에서도 로그인이 유지됩니다.</li>
            <li>비밀번호를 잊은 경우 <InlineCode>비밀번호를 잊으셨나요?</InlineCode> 링크를 사용하세요.</li>
          </ul>
        </InfoBox>
      </div>
    ),

    "forgot-password": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">비밀번호 찾기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          비밀번호를 잊은 경우, 등록된 이메일을 통해 재설정할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="비밀번호 찾기 페이지 접근">
            <p>로그인 페이지에서 <InlineCode>비밀번호를 잊으셨나요?</InlineCode> 링크를 클릭합니다.</p>
          </Step>
          <Step number={2} title="이메일 입력">
            <p>가입 시 사용한 이메일 주소를 입력하고 <InlineCode>비밀번호 재설정 링크 받기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={3} title="재설정 링크 클릭">
            <p>이메일로 발송된 비밀번호 재설정 링크를 클릭하여 새 비밀번호를 설정합니다.</p>
          </Step>
        </div>
      </div>
    ),

    /* ===== 대시보드 ===== */
    "dashboard-overview": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">대시보드 개요</h2>
        <p className="text-gray-600 dark:text-gray-400">
          로그인 후 가장 먼저 표시되는 화면입니다. 대시보드에서 주요 기능에 빠르게 접근할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">대시보드 구성 요소</h3>
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">상단 헤더</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              로고(법무법인 파로스), 테마 전환(다크/라이트 모드), 관리자 설정 버튼(관리자만), 사용자 메뉴가 표시됩니다.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">시작하기 안내</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              환영 메시지와 함께 시스템 사용 안내가 표시됩니다.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">빠른 접근 카드</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li><strong>파산 사건</strong>: 클릭하면 사건 목록 페이지로 이동</li>
              <li><strong>거래내역서</strong>: 파일 업로드 및 분석 안내</li>
              <li><strong>보고서</strong>: 분석 결과 내보내기 안내</li>
            </ul>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">사용자 메뉴</h3>
        <p className="text-gray-600 dark:text-gray-400">
          우측 상단의 사용자 이름(또는 이메일)을 클릭하면 드롭다운 메뉴가 열립니다:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li><strong>내 프로필</strong>: 프로필 정보 확인 및 수정</li>
          <li><strong>관리자 설정</strong>: 관리자 권한이 있는 경우에만 표시</li>
          <li><strong>로그아웃</strong>: 현재 세션을 종료하고 로그인 페이지로 이동</li>
        </ul>
      </div>
    ),

    navigation: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">메뉴 구조 안내</h2>
        <p className="text-gray-600 dark:text-gray-400">
          본 시스템의 주요 페이지 구조를 안내합니다.
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-5 font-mono text-sm space-y-1">
          <p className="text-gray-900 dark:text-gray-100 font-bold">법무법인 파로스</p>
          <p className="text-gray-600 dark:text-gray-400 pl-4">├── 대시보드 (/dashboard)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-4">├── 사건 목록 (/cases)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-8">├── 새 사건 등록 (/cases/new)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-8">├── 사건 상세 (/cases/[id])</p>
          <p className="text-gray-600 dark:text-gray-400 pl-8">└── 사건 수정 (/cases/[id]/edit)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-4">├── 내 프로필 (/dashboard/profile)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-4">├── 도움말 (/help)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-4">└── 관리자 전용</p>
          <p className="text-gray-600 dark:text-gray-400 pl-8">├── 관리자 설정 (/admin/settings)</p>
          <p className="text-gray-600 dark:text-gray-400 pl-8">└── 템플릿 관리 (/admin/templates)</p>
        </div>
      </div>
    ),

    /* ===== 사건 관리 ===== */
    "case-create": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">새 사건 등록</h2>
        <p className="text-gray-600 dark:text-gray-400">
          파산 사건을 시스템에 등록하는 방법을 안내합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="새 사건 등록 페이지 접근">
            <p>사건 목록 페이지 우측 상단의 <InlineCode>새 사건 등록</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="사건 정보 입력">
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong>사건번호</strong> (선택): 법원에서 부여한 사건번호를 입력합니다. (예: 2023하12345)</li>
              <li><strong>채무자명</strong> (필수): 파산 신청인의 이름을 입력합니다. 한글 또는 영문만 입력 가능합니다.</li>
              <li><strong>법원명</strong> (선택): 사건을 처리하는 법원명을 입력합니다. (예: 서울회생법원)</li>
              <li><strong>접수일자</strong> (선택): 사건 접수 날짜를 선택합니다. 미래 날짜는 선택할 수 없습니다.</li>
            </ul>
          </Step>
          <Step number={3} title="저장">
            <p><InlineCode>저장</InlineCode> 버튼을 클릭하면 사건이 등록되고 사건 목록으로 이동합니다.</p>
          </Step>
        </div>
        <InfoBox type="info" title="참고">
          <p>사건번호가 아직 없는 경우 비워두고, 나중에 수정할 수 있습니다. 채무자명은 필수 입력 항목입니다.</p>
        </InfoBox>
      </div>
    ),

    "case-list": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">사건 목록 조회</h2>
        <p className="text-gray-600 dark:text-gray-400">
          등록된 사건을 검색하고 조회하는 방법을 안내합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">검색 및 필터</h3>
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">검색 필드</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><strong>검색</strong>: 사건번호 또는 채무자명으로 검색</li>
              <li><strong>법원명</strong>: 특정 법원의 사건만 필터링</li>
              <li><strong>접수일자 (시작/종료)</strong>: 날짜 범위로 필터링</li>
              <li><strong>아카이브된 사건 보기</strong>: 체크 시 아카이브된 사건도 표시</li>
            </ul>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">정렬</h3>
        <p className="text-gray-600 dark:text-gray-400">
          테이블 헤더(사건번호, 채무자명, 법원명, 접수일자, 상태)를 클릭하면 해당 컬럼 기준으로 오름차순/내림차순 정렬됩니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">상태 분류</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "대기", color: "bg-yellow-100 text-yellow-800" },
            { label: "진행 중", color: "bg-blue-100 text-blue-800" },
            { label: "완료", color: "bg-green-100 text-green-800" },
            { label: "정지", color: "bg-orange-100 text-orange-800" },
            { label: "종료", color: "bg-gray-100 text-gray-800" },
          ].map((s) => (
            <span key={s.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
          ))}
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">페이지네이션</h3>
        <p className="text-gray-600 dark:text-gray-400">
          하단에 이전/다음 버튼으로 페이지를 이동할 수 있으며, 현재 표시 범위와 전체 건수가 표시됩니다.
        </p>
      </div>
    ),

    "case-detail": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">사건 상세 보기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          사건 목록에서 행을 클릭하면 해당 사건의 상세 페이지로 이동합니다. 사건 상세 페이지의 구성을 안내합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">페이지 구성</h3>
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">상단 액션 바</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li><strong>목록</strong>: 사건 목록으로 돌아가기</li>
              <li><strong>업로드</strong>: 거래내역서 파일 업로드 모달 열기</li>
              <li><strong>내보내기</strong>: 엑셀 파일로 데이터 내보내기</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">메인 영역 (2열 배치)</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li><strong>좌측 60%</strong>: 거래내역 테이블 (파일별 필터, 삭제 기능 포함)</li>
              <li><strong>우측 40%</strong>: AI 어시스턴트 채팅 + 퀵 버튼(대출금 소명자료, 금액 필터)</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">하단 영역 (2열 배치)</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li><strong>좌측 40%</strong>: 발견사항 목록</li>
              <li><strong>우측 60%</strong>: 사건 기본 정보(사건번호, 상태, 접수일자, 채무자명, 법원명, 담당 변호사) + 사건 메모</li>
            </ul>
          </div>
        </div>
      </div>
    ),

    "case-edit": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">사건 정보 수정</h2>
        <p className="text-gray-600 dark:text-gray-400">
          등록된 사건의 정보를 수정하는 방법을 안내합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="사건 상세 페이지에서 수정 페이지 접근">
            <p>사건 상세 페이지에서 수정 기능에 접근할 수 있습니다.</p>
          </Step>
          <Step number={2} title="수정 가능한 항목">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>채무자명</strong>: 한글 또는 영문, 50자 이내</li>
              <li><strong>법원명</strong>: 법원명 수정</li>
              <li><strong>접수일자</strong>: 날짜 변경</li>
              <li><strong>상태</strong>: 대기, 진행 중, 완료, 정지, 종료 중 선택</li>
            </ul>
          </Step>
          <Step number={3} title="저장">
            <p>수정 후 <InlineCode>저장</InlineCode> 버튼을 클릭하면 변경사항이 반영됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "case-archive": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">사건 아카이브</h2>
        <p className="text-gray-600 dark:text-gray-400">
          완료되거나 더 이상 활발하게 관리할 필요가 없는 사건을 아카이브할 수 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li>아카이브된 사건은 기본 목록에서 숨겨집니다.</li>
          <li>사건 목록 상단의 <InlineCode>아카이브된 사건 보기</InlineCode> 체크박스를 선택하면 아카이브된 사건을 확인할 수 있습니다.</li>
          <li>아카이브된 사건도 상세 조회, 수정이 가능합니다.</li>
        </ul>
      </div>
    ),

    /* ===== 거래내역 분석 ===== */
    "file-upload": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">파일 업로드</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래내역서 파일을 업로드하면 AI가 자동으로 파싱하고 분류합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="업로드 모달 열기">
            <p>사건 상세 페이지에서 상단의 <InlineCode>업로드</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="파일 선택">
            <p>업로드 영역에 파일을 드래그 앤 드롭하거나, 클릭하여 파일을 선택합니다.</p>
          </Step>
          <Step number={3} title="분석 대기">
            <p>파일이 업로드되면 자동으로 분석이 시작됩니다. 진행률 바가 표시되며, 완료 시 거래내역이 테이블에 표시됩니다.</p>
          </Step>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">지원 파일 형식</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">형식</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">확장자</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">엑셀</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">.xlsx, .xls</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">마이크로소프트 엑셀 파일</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">CSV</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">.csv</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">쉼표로 구분된 텍스트 파일</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">PDF</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">.pdf</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">PDF 문서 (OCR 파싱 지원)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <InfoBox type="warning" title="유의사항">
          <ul className="list-disc list-inside space-y-1">
            <li>파일 크기 제한이 있으므로 대용량 파일은 분할하여 업로드하세요.</li>
            <li>PDF 파일의 경우 OCR을 통해 텍스트를 추출하므로, 스캔 품질에 따라 정확도가 달라질 수 있습니다.</li>
            <li>업로드 시 기존 등록된 템플릿과 자동 매칭되어 컬럼이 매핑됩니다.</li>
          </ul>
        </InfoBox>
      </div>
    ),

    "transaction-table": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">거래내역 테이블</h2>
        <p className="text-gray-600 dark:text-gray-400">
          업로드된 거래내역은 사건 상세 페이지 좌측에 테이블 형태로 표시됩니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">테이블 컬럼</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><strong>거래일자</strong>: 거래가 발생한 날짜</li>
          <li><strong>구분</strong>: 입금 또는 출금</li>
          <li><strong>금액</strong>: 거래 금액 (입금은 양수, 출금은 음수로 표시)</li>
          <li><strong>잔액</strong>: 거래 후 잔액</li>
          <li><strong>비고</strong>: 거래 관련 메모 또는 적요</li>
          <li><strong>문서명</strong>: 해당 거래가 속한 원본 파일명 (전체 파일 보기 시)</li>
        </ul>
      </div>
    ),

    "transaction-filter": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">파일별 필터링</h2>
        <p className="text-gray-600 dark:text-gray-400">
          여러 파일을 업로드한 경우, 특정 파일의 거래내역만 필터링하여 볼 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="파일 선택 드롭다운">
            <p>거래내역 테이블 우측 상단의 드롭다운에서 원하는 파일을 선택합니다.</p>
          </Step>
          <Step number={2} title="전체 보기">
            <p>드롭다운에서 <InlineCode>전체 파일</InlineCode>을 선택하면 모든 파일의 거래내역이 표시됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "transaction-delete": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">거래내역 삭제</h2>
        <p className="text-gray-600 dark:text-gray-400">
          잘못 업로드한 파일이나 불필요한 거래내역을 삭제하는 방법을 안내합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="삭제할 파일 선택">
            <p>파일 선택 드롭다운에서 삭제할 파일을 선택합니다.</p>
          </Step>
          <Step number={2} title="삭제 버튼 클릭">
            <p>드롭다운 옆의 <InlineCode>삭제</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={3} title="확인">
            <p>삭제 확인 대화상자에서 확인하면 해당 파일의 모든 거래내역이 삭제됩니다.</p>
          </Step>
        </div>
        <InfoBox type="warning" title="주의">
          <p>삭제된 거래내역은 복구할 수 없습니다. 신중하게 진행하세요.</p>
        </InfoBox>
      </div>
    ),

    /* ===== AI 어시스턴트 ===== */
    "ai-chat": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI 채팅 사용법</h2>
        <p className="text-gray-600 dark:text-gray-400">
          사건 상세 페이지 우측에 AI 어시스턴트 채팅창이 있습니다. 거래내역에 대한 다양한 질문을 할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">사용 예시</h3>
        <div className="space-y-2">
          {[
            "이 사건의 총 입금액과 출금액은?",
            "100만원 이상 입금 거래를 정리해줘",
            "특이한 거래 패턴이 있어?",
            "대출금 사용 내역을 분석해줘",
            "이 거래내역에서 의심되는 부분을 찾아줘",
          ].map((q, idx) => (
            <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2">
              <p className="text-sm text-blue-800 dark:text-blue-200">"{q}"</p>
            </div>
          ))}
        </div>
        <InfoBox type="info" title="참고">
          <p>AI 어시스턴트의 응답은 참고용이며, 최종 판단은 법률 전문가가 내려야 합니다. AI 설정에서 제공자(Upstage, OpenAI, Anthropic)를 변경할 수 있습니다.</p>
        </InfoBox>
      </div>
    ),

    "loan-tracking": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">대출금 소명자료 생성</h2>
        <p className="text-gray-600 dark:text-gray-400">
          AI 어시스턴트 상단의 <InlineCode>대출금 사용 소명자료 생성</InlineCode> 버튼을 통해 대출금 사용 내역을 자동으로 추적하고 소명자료를 생성할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="퀵 버튼 클릭">
            <p>사건 상세 페이지 우측의 <InlineCode>대출금 사용 소명자료 생성</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="모달에서 조건 설정">
            <p>대출금 추적에 필요한 조건을 설정합니다.</p>
          </Step>
          <Step number={3} title="결과 확인">
            <p>AI가 분석한 대출금 사용 내역을 확인하고 활용합니다.</p>
          </Step>
        </div>
      </div>
    ),

    "amount-filter": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">금액 이상 입출금건 뽑기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          특정 금액 이상의 입출금 거래만 필터링하여 확인할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="퀵 버튼 클릭">
            <p>사건 상세 페이지 우측의 <InlineCode>금액 이상 입출금건 뽑기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="기준 금액 입력">
            <p>필터링할 기준 금액을 입력합니다.</p>
          </Step>
          <Step number={3} title="결과 확인">
            <p>기준 금액 이상의 입출금 거래 목록이 표시됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    /* ===== 발견사항 ===== */
    "findings-list": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">발견사항 목록</h2>
        <p className="text-gray-600 dark:text-gray-400">
          AI가 거래내역을 분석하면서 감지한 이상 거래, 중요 패턴 등이 발견사항으로 등록됩니다. 사건 상세 페이지 하단 좌측에 발견사항 목록이 표시됩니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">심각도 분류</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">CRITICAL</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">긴급 확인이 필요한 심각한 이상 거래</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">WARNING</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">주의가 필요한 의심 거래</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">INFO</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">참고용 정보</p>
          </div>
        </div>
      </div>
    ),

    "findings-detail": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">발견사항 상세</h2>
        <p className="text-gray-600 dark:text-gray-400">
          발견사항 카드를 클릭하면 상세 모달이 열리며, 다음 정보를 확인할 수 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><strong>제목 및 심각도</strong>: 발견사항 제목과 CRITICAL/WARNING/INFO 배지</li>
          <li><strong>설명</strong>: AI가 작성한 상세 설명</li>
          <li><strong>관련 채권자</strong>: 발견사항과 연관된 채권자 목록</li>
          <li><strong>관련 거래</strong>: 연관된 거래 ID 목록</li>
          <li><strong>연결된 거래 정보</strong>: 거래일, 메모, 입금액, 출금액</li>
          <li><strong>해결 상태</strong>: 해결 여부 및 해결 일시</li>
          <li><strong>메모</strong>: 발견사항에 추가된 메모 목록</li>
        </ul>
      </div>
    ),

    "findings-notes": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">발견사항 메모</h2>
        <p className="text-gray-600 dark:text-gray-400">
          각 발견사항에 메모를 추가하여 분석 내용이나 조치 사항을 기록할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="발견사항 상세 모달 열기">
            <p>발견사항 카드를 클릭하여 상세 모달을 엽니다.</p>
          </Step>
          <Step number={2} title="메모 입력">
            <p>모달 하단의 메모 입력란에 내용을 작성하고 저장합니다.</p>
          </Step>
          <Step number={3} title="메모 확인">
            <p>작성된 메모는 시간순으로 표시되며, 작성자 정보가 함께 기록됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    /* ===== 내보내기 ===== */
    "export-full": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">전체 내보내기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          사건의 전체 데이터를 엑셀 파일로 내보낼 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="내보내기 버튼 클릭">
            <p>사건 상세 페이지 상단의 <InlineCode>내보내기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="내보내기 옵션 선택">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>전체 분석 결과</strong>: 모든 거래내역 + 발견사항 포함</li>
              <li><strong>거래내역만</strong>: 거래내역 데이터만 내보내기</li>
              <li><strong>발견사항만</strong>: 발견사항 목록만 내보내기</li>
              <li><strong>자금 흐름</strong>: 자금 흐름 분석 데이터 내보내기</li>
            </ul>
          </Step>
          <Step number={3} title="다운로드">
            <p>옵션을 선택하면 엑셀 파일이 자동으로 다운로드됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "export-selected": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">선택 내보내기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          특정 거래만 선택하여 내보내거나, 포함할 컬럼을 선택할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">선택 가능한 컬럼</h3>
        <div className="flex flex-wrap gap-2">
          {["메모", "태그", "신뢰도", "AI 분류", "거래 성격"].map((col) => (
            <span key={col} className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{col}</span>
          ))}
        </div>
      </div>
    ),

    "export-findings": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">발견사항 내보내기</h2>
        <p className="text-gray-600 dark:text-gray-400">
          발견사항 목록을 필터링하여 엑셀 파일로 내보낼 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">필터 옵션</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li><strong>해결 상태</strong>: 해결됨 / 미해결</li>
          <li><strong>심각도</strong>: CRITICAL / WARNING / INFO</li>
          <li><strong>중요도</strong>: HIGH / MEDIUM / LOW</li>
          <li><strong>정렬</strong>: 중요도-심각도-날짜 / 심각도-날짜 / 날짜 순</li>
        </ul>
      </div>
    ),

    /* ===== 사건 메모 ===== */
    "note-create": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">메모 추가</h2>
        <p className="text-gray-600 dark:text-gray-400">
          사건에 메모를 추가하여 분석 내용, 조치 사항, 참고 정보 등을 기록할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="사건 상세 페이지 하단의 사건 메모 섹션 확인">
            <p>사건 상세 페이지 우측 하단에 &ldquo;사건 메모&rdquo; 카드가 있습니다.</p>
          </Step>
          <Step number={2} title="메모 내용 입력">
            <p>텍스트 입력란에 메모 내용을 작성합니다. 최대 1,000자까지 입력 가능합니다.</p>
          </Step>
          <Step number={3} title="메모 추가 버튼 클릭">
            <p><InlineCode>메모 추가</InlineCode> 버튼을 클릭하면 메모가 즉시 저장되고 목록에 추가됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "note-edit": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">메모 수정/삭제</h2>
        <p className="text-gray-600 dark:text-gray-400">
          자신이 작성한 메모는 수정하거나 삭제할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">수정</h3>
        <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li>수정할 메모 오른쪽의 <InlineCode>수정</InlineCode> 버튼을 클릭합니다.</li>
          <li>내용을 수정한 후 <InlineCode>저장</InlineCode> 버튼을 클릭합니다.</li>
          <li>수정을 취소하려면 <InlineCode>취소</InlineCode> 버튼을 클릭합니다.</li>
        </ol>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">삭제</h3>
        <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li>삭제할 메모 오른쪽의 <InlineCode>삭제</InlineCode> 버튼을 클릭합니다.</li>
          <li>삭제 확인 대화상자에서 <InlineCode>삭제</InlineCode>를 클릭하면 메모가 영구 삭제됩니다.</li>
        </ol>
        <InfoBox type="warning" title="주의">
          <p>본인이 작성한 메모만 수정/삭제할 수 있습니다. 삭제된 메모는 복구할 수 없습니다.</p>
        </InfoBox>
      </div>
    ),

    /* ===== 프로필 관리 ===== */
    "profile-view": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">프로필 조회</h2>
        <p className="text-gray-600 dark:text-gray-400">
          대시보드 상단 사용자 메뉴에서 <InlineCode>내 프로필</InlineCode>을 클릭하여 프로필 페이지에 접근합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">확인 가능한 정보</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li><strong>이메일</strong>: 가입 시 등록한 이메일</li>
          <li><strong>역할</strong>: 변호사, 법무사, 관리자, 지원팀</li>
          <li><strong>계정 상태</strong>: 활성/비활성</li>
          <li><strong>가입일</strong>: 계정 생성 날짜</li>
        </ul>
      </div>
    ),

    "profile-name": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">이름 변경</h2>
        <p className="text-gray-600 dark:text-gray-400">
          프로필 페이지에서 이름을 변경할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="이름 입력란에 새 이름 입력">
            <p>프로필 정보 카드 하단의 &ldquo;이름&rdquo; 입력란에 원하는 이름을 입력합니다.</p>
          </Step>
          <Step number={2} title="저장 클릭">
            <p><InlineCode>저장</InlineCode> 버튼을 클릭하면 이름이 즉시 변경됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "profile-email": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">이메일 변경</h2>
        <p className="text-gray-600 dark:text-gray-400">
          이메일을 변경하면 새 이메일로 인증이 필요합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="이메일 변경하기 버튼 클릭">
            <p>프로필 페이지의 &ldquo;이메일 변경&rdquo; 카드에서 <InlineCode>이메일 변경하기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="새 이메일 입력">
            <p>변경할 새 이메일 주소를 입력합니다.</p>
          </Step>
          <Step number={3} title="인증 링크 발송">
            <p><InlineCode>인증 링크 발송</InlineCode> 버튼을 클릭하면 새 이메일로 인증 링크가 발송됩니다.</p>
          </Step>
          <Step number={4} title="인증 완료">
            <p>새 이메일에서 인증을 완료하면 이메일이 변경되고, 자동으로 로그아웃됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    "profile-password": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">비밀번호 변경</h2>
        <p className="text-gray-600 dark:text-gray-400">
          보안을 위해 비밀번호를 정기적으로 변경하는 것을 권장합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="비밀번호 변경하기 버튼 클릭">
            <p>프로필 페이지의 &ldquo;비밀번호 변경&rdquo; 카드에서 <InlineCode>비밀번호 변경하기</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="현재 비밀번호 입력">
            <p>현재 사용 중인 비밀번호를 입력합니다.</p>
          </Step>
          <Step number={3} title="새 비밀번호 입력">
            <p>새 비밀번호를 입력하고 확인란에 동일하게 입력합니다. (8자 이상)</p>
          </Step>
          <Step number={4} title="변경 완료">
            <p><InlineCode>비밀번호 변경</InlineCode> 버튼을 클릭하면 변경이 완료되고, 자동으로 로그아웃됩니다.</p>
          </Step>
        </div>
      </div>
    ),

    /* ===== 관리자 가이드 ===== */
    "admin-intro": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">관리자 권한 안내</h2>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
          <p className="text-purple-800 dark:text-purple-200 font-medium text-lg mb-2">관리자 전용 기능</p>
          <p className="text-purple-700 dark:text-purple-300 text-sm leading-relaxed">
            관리자(ADMIN) 역할을 가진 사용자만 아래 기능에 접근할 수 있습니다.
          </p>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">관리자 권한으로 가능한 작업</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><strong>AI 분류 설정</strong>: AI 제공자 선택 및 API 키 관리</li>
          <li><strong>AWS S3 설정</strong>: 파일 저장소 설정</li>
          <li><strong>거래내역서 템플릿 관리</strong>: 은행별 거래내역서 형식 정의 및 관리</li>
          <li><strong>모든 일반 사용자 기능</strong>: 사건 관리, 거래내역 분석 등</li>
        </ul>
      </div>
    ),

    "admin-access": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">관리자 메뉴 접근</h2>
        <p className="text-gray-600 dark:text-gray-400">
          관리자 설정 페이지에 접근하는 방법을 안내합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="대시보드 헤더에서 설정 아이콘 클릭">
            <p>관리자 계정으로 로그인하면 대시보드 상단 헤더에 톱니바퀴 아이콘(설정)이 표시됩니다. 이 아이콘을 클릭합니다.</p>
          </Step>
          <Step number={2} title="또는 사용자 메뉴에서 접근">
            <p>사용자 이름을 클릭하여 드롭다운 메뉴를 열고 <InlineCode>관리자 설정</InlineCode>을 선택합니다.</p>
          </Step>
        </div>
      </div>
    ),

    /* ===== AI 설정 ===== */
    "ai-provider": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI 제공자 설정</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래 자동 분류에 사용할 AI 제공자를 선택할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">지원되는 AI 제공자</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">제공자</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">특징</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">키 발급처</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Upstage Solar</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">한국어 최적화, 높은 정확도</td>
                <td className="px-4 py-3 text-blue-600 dark:text-blue-400">console.upstage.ai</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">OpenAI GPT</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">범용 AI, 다양한 모델 선택</td>
                <td className="px-4 py-3 text-blue-600 dark:text-blue-400">platform.openai.com/api-keys</td>
              </tr>
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Anthropic Claude</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">정교한 분석, 긴 컨텍스트</td>
                <td className="px-4 py-3 text-blue-600 dark:text-blue-400">console.anthropic.com</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-4 mt-4">
          <Step number={1} title="관리자 설정 페이지 접근">
            <p>대시보드에서 설정 아이콘을 클릭합니다.</p>
          </Step>
          <Step number={2} title="AI 제공자 드롭다운에서 선택">
            <p>AI 분류 설정 섹션의 &ldquo;AI 제공자&rdquo; 드롭다운에서 원하는 제공자를 선택합니다.</p>
          </Step>
          <Step number={3} title="저장">
            <p>페이지 하단의 <InlineCode>저장</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
        </div>
      </div>
    ),

    "ai-keys": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API 키 관리</h2>
        <p className="text-gray-600 dark:text-gray-400">
          각 AI 제공자의 API 키를 안전하게 저장하고 관리합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="API 키 입력">
            <p>해당 AI 제공자의 API 키 입력란에 키를 입력합니다. 비밀번호 형태로 표시되며, 빈칸으로 두면 기존 값이 유지됩니다.</p>
          </Step>
          <Step number={2} title="저장">
            <p><InlineCode>저장</InlineCode> 버튼을 클릭하면 암호화되어 안전하게 저장됩니다.</p>
          </Step>
        </div>
        <InfoBox type="warning" title="보안 유의사항">
          <ul className="list-disc list-inside space-y-1">
            <li>API 키는 암호화되어 저장됩니다.</li>
            <li>키를 변경할 때만 새 값을 입력하세요. 빈칸은 기존 값을 유지합니다.</li>
            <li>API 키가 노출되지 않도록 주의하세요.</li>
          </ul>
        </InfoBox>
      </div>
    ),

    /* ===== S3 설정 ===== */
    "s3-config": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AWS S3 설정</h2>
        <p className="text-gray-600 dark:text-gray-400">
          업로드된 파일을 저장할 AWS S3 버킷을 설정합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">설정 항목</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><strong>AWS Access Key ID</strong>: AWS IAM 사용자의 액세스 키 ID</li>
          <li><strong>AWS Secret Access Key</strong>: AWS IAM 사용자의 시크릿 액세스 키</li>
          <li><strong>AWS Region</strong>: S3 버킷이 위치한 리전 (예: ap-northeast-2 = 서울)</li>
          <li><strong>S3 Bucket Name</strong>: 파일을 저장할 S3 버킷 이름</li>
        </ul>
        <InfoBox type="info" title="참고">
          <ul className="list-disc list-inside space-y-1">
            <li>서울 리전: ap-northeast-2</li>
            <li>도쿄 리전: ap-northeast-1</li>
            <li>S3 버킷은 미리 생성되어 있어야 합니다.</li>
            <li>IAM 사용자에게 S3 읽기/쓰기 권한이 필요합니다.</li>
          </ul>
        </InfoBox>
      </div>
    ),

    /* ===== 템플릿 관리 ===== */
    "template-overview": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">템플릿 개요</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래내역서 템플릿은 은행별, 카드사별로 다른 거래내역서 형식을 정의하는 기능입니다. 
          템플릿을 등록하면 파일 업로드 시 자동으로 매칭되어 정확한 파싱이 가능합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">템플릿 매칭 과정</h3>
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Layer 1: 키워드 정확 매칭</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              문서 텍스트에서 템플릿의 식별자(키워드)가 모두 포함되면 자동 매칭됩니다.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Layer 2: LLM 유사도 매칭</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              키워드 매칭이 실패하면 AI(LLM)가 템플릿 설명과 문서를 비교하여 유사도 기반으로 매칭합니다.
            </p>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">통계 대시보드</h3>
        <p className="text-gray-600 dark:text-gray-400">
          템플릿 관리 페이지 상단에 전체 템플릿 수, 활성 템플릿 수, 총 매칭 횟수 통계가 표시됩니다.
        </p>
      </div>
    ),

    "template-create": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">새 템플릿 생성</h2>
        <p className="text-gray-600 dark:text-gray-400">
          새 거래내역서 형식에 대한 템플릿을 생성하는 방법을 안내합니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="새 템플릿 버튼 클릭">
            <p>템플릿 관리 페이지 우측 상단의 <InlineCode>새 템플릿</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="샘플 파일 업로드 (필수)">
            <p>AI 자동 분석 영역에서 거래내역서 PDF 또는 스크린샷을 업로드합니다. AI가 파일을 분석하여 템플릿 초안을 자동 생성합니다.</p>
          </Step>
          <Step number={3} title="기본 정보 확인/수정">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>템플릿 이름</strong>: AI가 제안한 이름을 확인하고 필요시 수정</li>
              <li><strong>은행명/카드사명</strong>: 해당 금융기관명</li>
              <li><strong>템플릿 설명</strong>: 거래내역서의 특징 설명 (LLM 유사도 매칭에 사용)</li>
              <li><strong>식별자</strong>: 쉼표로 구분된 키워드 (키워드 정확 매칭에 사용)</li>
            </ul>
          </Step>
          <Step number={4} title="컬럼 매핑 확인">
            <p>AI가 분석한 컬럼 매핑을 확인하고 필요시 수정합니다.</p>
          </Step>
          <Step number={5} title="저장">
            <p><InlineCode>저장</InlineCode> 버튼을 클릭하여 템플릿을 생성합니다.</p>
          </Step>
        </div>
      </div>
    ),

    "template-ai-analyze": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI 자동 분석</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래내역서 파일을 업로드하면 AI가 자동으로 분석하여 템플릿 초안을 생성합니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">분석 결과</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><strong>템플릿 이름</strong>: 은행명 + 형식 기반 자동 제안</li>
          <li><strong>은행명</strong>: 문서에서 추출한 금융기관명</li>
          <li><strong>설명</strong>: 거래내역서 형식의 특징 설명</li>
          <li><strong>식별자</strong>: 자동 추출된 키워드</li>
          <li><strong>헤더 목록</strong>: 거래내역서 테이블의 컬럼 헤더</li>
          <li><strong>컬럼 매핑</strong>: 각 헤더가 어떤 데이터 유형인지 자동 매핑</li>
          <li><strong>신뢰도</strong>: AI 분석의 정확도 (백분율)</li>
        </ul>
        <InfoBox type="info" title="지원 파일 형식">
          <p>이미지 파일(JPG, PNG 등) 또는 PDF 파일을 업로드할 수 있습니다. 거래내역서의 테이블 부분이 명확하게 보이는 파일을 사용하면 분석 정확도가 높아집니다.</p>
        </InfoBox>
      </div>
    ),

    "template-column": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">컬럼 매핑 설정</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래내역서의 각 컬럼이 어떤 데이터를 나타내는지 매핑하는 설정입니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">컬럼 유형</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">유형</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {[
                { type: "거래일자", desc: "거래가 발생한 날짜" },
                { type: "입금액", desc: "입금 금액 컬럼" },
                { type: "출금액 / 이용금액", desc: "출금 또는 카드 이용 금액 컬럼" },
                { type: "잔액", desc: "거래 후 잔액" },
                { type: "비고", desc: "거래 관련 메모, 적요" },
                { type: "거래구분", desc: "입금/출금을 구분하는 텍스트 컬럼" },
                { type: "거래금액 (단일)", desc: "입출금을 구분하지 않는 단일 금액 컬럼" },
              ].map((row) => (
                <tr key={row.type} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.type}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">컬럼 매핑 유형 가이드</h3>
        <div className="space-y-4">
          <div className="border-l-4 border-green-400 pl-4 py-2">
            <h4 className="font-semibold text-green-700 dark:text-green-400">유형 A: 입금액/출금액 분리형 (가장 일반적)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              국민은행, 신한은행, 우리은행 등 대부분의 은행이 사용하는 형식입니다.<br />
              입금 거래는 입금액 컬럼에만 값이 있고, 출금 거래는 출금액 컬럼에만 값이 있습니다.
            </p>
          </div>
          <div className="border-l-4 border-purple-400 pl-4 py-2">
            <h4 className="font-semibold text-purple-700 dark:text-purple-400">유형 B: 거래구분 + 단일금액형</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              일부 증권사, 카드사에서 사용하는 형식입니다.<br />
              &ldquo;입금&rdquo;, &ldquo;출금&rdquo; 등의 텍스트 구분 컬럼과 단일 금액 컬럼이 있습니다.
            </p>
          </div>
          <div className="border-l-4 border-amber-400 pl-4 py-2">
            <h4 className="font-semibold text-amber-700 dark:text-amber-400">유형 C: 비고 혼재형 (특수)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              부산은행 등 특수한 형식입니다.<br />
              입금 시 출금액 컬럼에 비고가, 출금 시 입금액 컬럼에 비고가 들어갑니다.
            </p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">행 병합 설정</h3>
        <p className="text-gray-600 dark:text-gray-400">
          NH농협처럼 1개 거래가 2개 행으로 분리된 경우 &ldquo;2행 병합&rdquo; 옵션을 선택합니다.
        </p>
      </div>
    ),

    "template-edit": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">템플릿 수정/삭제</h2>
        <p className="text-gray-600 dark:text-gray-400">
          기존 템플릿을 수정, 삭제, 복제할 수 있습니다.
        </p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">작업 버튼</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
          <li><Edit className="inline h-4 w-4 mr-1" /><strong>수정</strong>: 연필 아이콘을 클릭하면 템플릿 에디터가 열립니다.</li>
          <li><Copy className="inline h-4 w-4 mr-1" /><strong>복제</strong>: 복사 아이콘을 클릭하면 기존 템플릿을 기반으로 새 템플릿을 생성합니다.</li>
          <li><Trash2 className="inline h-4 w-4 mr-1" /><strong>삭제</strong>: 휴지통 아이콘을 클릭하면 확인 후 삭제됩니다.</li>
        </ul>
      </div>
    ),

    "template-test": (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">매칭 테스트</h2>
        <p className="text-gray-600 dark:text-gray-400">
          거래내역서 PDF를 업로드하여 등록된 템플릿 중 어떤 것과 매칭되는지 테스트할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Step number={1} title="매칭 테스트 버튼 클릭">
            <p>템플릿 관리 페이지의 <InlineCode>매칭 테스트</InlineCode> 버튼을 클릭합니다.</p>
          </Step>
          <Step number={2} title="PDF 파일 업로드">
            <p>테스트할 거래내역서 PDF 파일을 업로드합니다.</p>
          </Step>
          <Step number={3} title="결과 확인">
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li><strong>매칭 성공</strong>: 매칭된 템플릿명, 매칭 레이어(Layer 1/2), 신뢰도, 추출된 헤더, 컬럼 매핑, 샘플 데이터가 표시됩니다.</li>
              <li><strong>매칭 실패</strong>: 추출된 헤더가 표시되며, 이를 기반으로 새 템플릿을 생성할 수 있습니다.</li>
            </ul>
          </Step>
        </div>
      </div>
    ),
  };

  return sections[sectionId] || (
    <div className="text-center py-12">
      <HelpCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <p className="text-gray-500 dark:text-gray-400">좌측 메뉴에서 항목을 선택해주세요.</p>
    </div>
  );
}

/* ───────────── 헬퍼 컴포넌트 ───────────── */
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h4>
        <div className="text-sm text-gray-600 dark:text-gray-400">{children}</div>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold">
      {children}
    </code>
  );
}

function InfoBox({ type, title, children }: { type: "info" | "warning"; title: string; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
  };
  return (
    <div className={`border rounded-lg p-4 ${styles[type]}`}>
      <h4 className="font-semibold mb-2">{title}</h4>
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
}

/* ───────────── 사이드바 아이템 ───────────── */
function SidebarItem({
  item,
  activeSection,
  onSelect,
}: {
  item: MenuItem;
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  const hasActiveChild = item.children?.some((child) => child.id === activeSection);
  const [isOpen, setIsOpen] = useState(hasActiveChild || false);

  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  return (
    <div>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (item.children && item.children.length > 0) {
            onSelect(item.children[0]!.id);
          }
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          hasActiveChild
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        data-testid={`help-sidebar-${item.id}`}
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        {item.children && (
          isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {isOpen && item.children && (
        <div className="ml-6 mt-1 space-y-0.5">
          {item.children.map((child) => (
            <button
              key={child.id}
              onClick={() => onSelect(child.id)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeSection === child.id
                  ? "bg-blue-100 dark:bg-blue-800/40 text-blue-800 dark:text-blue-200 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
              data-testid={`help-sidebar-${child.id}`}
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── 메인 페이지 ───────────── */
export default function HelpPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // URL hash에서 섹션 복원
  useEffect(() => {
    if (router.query.section && typeof router.query.section === "string") {
      setActiveSection(router.query.section);
      // 관리자 가이드 섹션인지 확인
      const isAdmin = adminGuideMenu.some(
        (m) => m.id === router.query.section || m.children?.some((c) => c.id === router.query.section)
      );
      if (isAdmin) setActiveTab("admin");
    }
  }, [router.query.section]);

  const handleSelect = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    // URL 업데이트 (히스토리 유지)
    void router.replace({ pathname: "/help", query: { section: id } }, undefined, { shallow: true });
  };

  const currentMenu = activeTab === "user" ? userGuideMenu : adminGuideMenu;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="help-page">
      {/* 상단 헤더 */}
      <header className="border-b bg-white dark:bg-gray-800 dark:border-gray-700 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* 햄버거 메뉴 (모바일 + 데스크톱 공통) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              data-testid="help-hamburger-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">법무법인 파로스</h1>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">도움말</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && user?.role === "ADMIN" && (
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/templates")} data-testid="help-templates-link">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">템플릿 관리</span>
              </Button>
            )}
            <ThemeToggleButton />
            {isAuthenticated ? (
              <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} data-testid="help-dashboard-link">
                대시보드
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => router.push("/login")} data-testid="help-login-link">
                로그인
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto flex" style={{ height: "calc(100vh - 57px)" }}>
        {/* 사이드바 오버레이 (햄버거 버튼으로 토글) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 overflow-y-auto shadow-xl animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
              data-testid="help-sidebar"
            >
              <div className="px-4 pt-4 pb-2 border-b dark:border-gray-700">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => { setActiveTab("user"); setActiveSection("overview"); }}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "user"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                    data-testid="help-tab-user"
                  >
                    사용자 가이드
                  </button>
                  <button
                    onClick={() => { setActiveTab("admin"); setActiveSection("admin-intro"); }}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "admin"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                    data-testid="help-tab-admin"
                  >
                    관리자 가이드
                  </button>
                </div>
              </div>
              <nav className="p-4 space-y-1">
                {currentMenu.map((item) => (
                  <SidebarItem key={item.id} item={item} activeSection={activeSection} onSelect={handleSelect} />
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* 콘텐츠 영역 */}
        <main ref={contentRef} className="flex-1 overflow-y-auto p-6 lg:p-10" data-testid="help-content">
          <div className="max-w-4xl mx-auto">
            <GuideContent sectionId={activeSection} />
          </div>
        </main>
      </div>
    </div>
  );
}
