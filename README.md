# ON THE GROUND — 직원 가이드

매장 내부용 가이드 사이트. 칵테일 레시피와 운영 절차를 직원들이 폰에서 바로 열어 보는 용도.

- **콘텐츠: 레포 안의 마크다운 파일** (`content/<언어>/*.md`) — 외부 서비스 의존 없음. 추가·수정은 클로드에게 말로 시키고, 급하면 폰 브라우저의 GitHub 편집 화면에서 직접 고칩니다. 어느 쪽이든 1~2분 뒤 자동 반영됩니다.
- **언어: 한국어 / 영어** — 우측 상단 버튼으로 전환하고, 선택은 브라우저에 기억됩니다. 언어 추가는 `LANGUAGES` 에 한 줄과 번역 폴더 하나면 됩니다.
- **접근 권한: 사이트 전체 공용 비밀번호** — 직원 모두가 같은 암호를 씁니다.
- **영상: 유튜브 일부 공개** — `{제공자, 영상ID}` 형태로만 저장하므로, 나중에 Cloudflare Stream 등으로 바꿀 때 `src/video.ts` 한 곳만 고치면 됩니다.

기술 스택은 손님용 사이트(`otg-bar`)와 같은 계열입니다: TypeScript + Vite, React·Tailwind 없음. 런타임 의존성 0개. 배포는 Vercel.

**처음 세팅과 글 쓰는 법은 [SETUP.md](./SETUP.md)를 보세요.**

---

## 구조

```
content/ko/*.md     한국어 콘텐츠. 파일 하나 = 항목 하나
content/en/*.md     영어 콘텐츠. 같은 파일 이름끼리 짝을 이룹니다
CLAUDE.md           작업 규칙 (다국어 필수, 매장 정보 추측 금지 등)
index.html          진입점
src/main.ts         화면 전체 (로그인 → 탭 목록 → 상세)
src/video.ts        {제공자, 영상ID} → 임베드 URL. 영상 제공자 교체 지점
src/styles.css      스타일 (모바일 우선, 다크)
api/login.ts        비밀번호 확인 후 세션 쿠키 발급
api/logout.ts       세션 해제
api/content.ts      세션 확인 후 콘텐츠 반환
lib/auth.ts         쿠키 서명·검증
lib/markdown.ts     content/<언어>/*.md → 사이트 데이터. 콘텐츠 출처 교체 지점
lib/content.ts      타입 정의, 지원 언어 목록(LANGUAGES), 영상 링크 파싱
```

콘텐츠가 정적 번들에 들어가지 않고 서버 함수를 거쳐 나가므로, 비밀번호를 통과한 브라우저만 레시피를 받습니다.

## 환경 변수

| 이름 | 값 |
|---|---|
| `SITE_PASSWORD` | 직원들에게 알려줄 사이트 비밀번호 |
| `SESSION_SECRET` | 아무 긴 랜덤 문자열 (로그인 쿠키 서명용) |

`SITE_PASSWORD`를 비워두면 비밀번호 없이 누구나 들어옵니다. 배포 시 반드시 설정하세요.

## 비용

전부 무료입니다. 정기 결제 없음.

| 항목 | 플랜 | 비용 |
|---|---|---|
| 콘텐츠 저장 | GitHub 레포 | 0원 |
| 호스팅 | Vercel Hobby | 0원 |
| 영상 | 유튜브 일부 공개 | 0원 |

단, **Vercel Hobby 플랜은 약관상 상업적 사용을 금지**합니다 (상업적 사용은 Pro $20/월). 매장 운영용 내부 도구가 여기 걸릴 소지가 있습니다. 문제가 되면 **Cloudflare Pages**로 옮기면 됩니다 — 무료 플랜에서 상업적 사용이 허용되고, 고칠 곳은 `api/` 폴더의 함수 3개 형식뿐입니다. 요금과 약관은 바뀔 수 있으니 직접 확인하세요.

## 로컬 개발

```bash
npm install
npm run dev      # 프런트엔드만 (API 없이 로그인 화면에서 막힘)
npx vercel dev   # API 포함 전체 동작 — .env.local 에 환경 변수 필요
```

`.env.example`을 `.env.local`로 복사해 값을 채우세요.

## 나중에 바꿀 수 있는 것

- **콘텐츠 출처** — 나중에 직원들이 직접 글을 올려야 해지면 노션 연동이나 사이트 내 업로드로 교체. 고칠 곳은 `lib/markdown.ts`의 `loadContent()` 하나이고, 화면과 타입은 그대로입니다.
- **영상 제공자** — 유튜브 → Cloudflare Stream 등. `src/video.ts`의 `embedUrl()` 하나.
- **접근 권한** — 공용 비밀번호 → 직원별 로그인. `lib/auth.ts`.
- **언어 추가** — `lib/content.ts`의 `LANGUAGES`에 한 줄, `src/main.ts`의 `UI`에 화면 문구 한 벌, `content/<코드>/` 폴더 하나.
