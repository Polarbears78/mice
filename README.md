# 🎙️ 녹음 & 전사 (Recording & Transcription)

브라우저에서 바로 동작하는 음성 녹음 + 실시간 전사 웹 앱입니다. 별도 서버나 API 키 없이 브라우저 내장 API만 사용합니다.

## 주요 기능

- **음성 녹음** — MediaRecorder API 기반 녹음 / 일시정지 / 재개 / 정지
- **실시간 전사** — Web Speech API로 말하는 즉시 텍스트 변환 (한국어, 영어, 일본어, 중국어 등 7개 언어)
- **오디오 시각화** — 녹음 중 실시간 주파수 시각화 및 경과 시간 표시
- **전사 관리** — 복사, `.txt` 다운로드, 지우기
- **녹음 기록** — 세션 내 녹음 목록에서 재생, 오디오/전사 다운로드, 삭제

## 📱 모바일 앱으로 설치 (PWA)

이 앱은 PWA(Progressive Web App)라서 폰 홈 화면에 설치하면 일반 앱처럼 동작합니다.

1. 배포된 주소를 폰 브라우저로 엽니다 — GitHub Pages 배포 시 `https://polarbears78.github.io/mice/`
2. **Android (Chrome)**: 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"
3. **iPhone (Safari)**: 공유 버튼 → "홈 화면에 추가"

설치하면 전체 화면 앱으로 실행되고, 서비스 워커 캐시 덕분에 오프라인에서도 열립니다 (녹음은 오프라인 가능, 전사는 인터넷 필요).

> `main` 브랜치에 푸시하면 GitHub Actions가 자동으로 GitHub Pages에 배포합니다 (`.github/workflows/deploy.yml`).

## 실행 방법

정적 파일이므로 아무 웹 서버로나 서빙하면 됩니다:

```bash
# Python
python3 -m http.server 8000

# 또는 Node
npx serve .
```

브라우저에서 `http://localhost:8000` 접속 후 마이크 권한을 허용하세요.

> 마이크 접근은 `localhost` 또는 HTTPS 환경에서만 허용됩니다.

## 브라우저 지원

| 기능 | Chrome / Edge | Safari | Firefox |
|------|:---:|:---:|:---:|
| 녹음 | ✅ | ✅ | ✅ |
| 실시간 전사 | ✅ | ⚠️ 부분 지원 | ❌ |

실시간 전사(Web Speech API)는 **Chrome 또는 Edge**에서 가장 안정적으로 동작합니다. 전사가 지원되지 않는 브라우저에서는 녹음 기능만 사용할 수 있습니다.

## 파일 구성

```
index.html            # 앱 구조 (UI)
style.css             # 스타일 (라이트/다크 모드, 모바일 대응)
app.js                # 녹음·전사·시각화 로직
manifest.webmanifest  # PWA 매니페스트 (홈 화면 설치)
sw.js                 # 서비스 워커 (오프라인 캐시)
icons/                # 앱 아이콘
```

## 참고 사항

- 녹음 기록은 브라우저 메모리에만 유지되며, 페이지를 새로고침하면 사라집니다. 보관이 필요한 녹음은 다운로드 버튼으로 저장하세요.
- Web Speech API는 브라우저 벤더의 음성 인식 서비스를 사용하므로 인터넷 연결이 필요합니다.
