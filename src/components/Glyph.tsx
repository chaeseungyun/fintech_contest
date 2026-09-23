import type { IconKey } from '../lib/types';

/** 아이콘은 키 하나로 정해진다. 화면에서 그림을 고르지 않는다. */
const PATHS: Record<string, JSX.Element> = {
  account: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </>
  ),
  loan: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  invest: (
    <>
      <path d="M4 19V9" />
      <path d="M9.5 19V5" />
      <path d="M15 19v-7" />
      <path d="M20.5 19V8" />
    </>
  ),
  insurance: (
    <>
      <path d="M12 3.5 5 6.5v5.2c0 4.3 2.9 7.6 7 8.8 4.1-1.2 7-4.5 7-8.8V6.5Z" />
      <path d="m9 12 2.2 2.2L15.2 10" />
    </>
  ),
  benefit: (
    <>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z" />
    </>
  ),
  deposit: (
    <>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="3" />
      <path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  autopay: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
      <path d="M20 4.5v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
      <path d="M4 19.5v-4h4" />
    </>
  ),
  /* 서비스 표식 — 반짝이가 아니라 상품 셋을 잇는 선. 이 앱이 하는 일(연결 분석)을 그대로 그린다. */
  ai: (
    <>
      <circle cx="12" cy="5.5" r="2.3" />
      <circle cx="5.5" cy="17" r="2.3" />
      <circle cx="18.5" cy="17" r="2.3" />
      <path d="M10.9 7.5 6.6 15" />
      <path d="m13.1 7.5 4.3 7.5" />
      <path d="M7.8 17h8.4" />
    </>
  ),
  grid: (
    <>
      <circle cx="6" cy="6" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="18" cy="6" r="1.6" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
      <circle cx="18" cy="18" r="1.6" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8v.6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="m15 5-7 7 7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  eye: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  arrow: (
    <>
      <path d="M4.5 12h14" />
      <path d="m13 6.5 5.5 5.5L13 17.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  phone: (
    <>
      <path d="M7.5 3.8h3l1.3 3.4-2 1.4a11 11 0 0 0 5.6 5.6l1.4-2 3.4 1.3v3a2 2 0 0 1-2.2 2C11.4 18 6 12.6 5.5 6a2 2 0 0 1 2-2.2Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  save: (
    <>
      <path d="M12 4.5v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
};

export type GlyphName = IconKey | keyof typeof PATHS;

interface Props {
  name: GlyphName;
  size?: number;
  className?: string;
}

export function Glyph({ name, size = 24, className }: Props) {
  const body = PATHS[name] ?? PATHS.grid;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}

/** 상품 종류 → 아이콘 키. 한 군데서만 정한다. */
export const TYPE_ICON: Record<string, IconKey> = {
  deposit_account: 'account',
  savings: 'deposit',
  term_deposit: 'deposit',
  investment: 'invest',
  loan: 'loan',
  credit_card: 'card',
  insurance: 'insurance',
  autopay: 'autopay',
};
