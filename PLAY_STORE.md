# 📲 Google Play 등록 가이드

이 저장소에는 PWA를 Google Play에 올리기 위한 TWA(Trusted Web Activity) 안드로이드 프로젝트(`android/`)와 자동 빌드 워크플로가 포함되어 있습니다. 아래 순서대로 진행하세요.

## 1. 등록용 파일(AAB) 빌드

1. GitHub 저장소 → **Actions** 탭 → **Build Android App (TWA)** 선택 → **Run workflow** 클릭
2. 빌드가 끝나면 (약 3~5분) 워크플로 실행 페이지 하단 **Artifacts**에서 내려받기:
   - `play-release` — Play에 올릴 `app-release.aab` + 테스트용 `app-release.apk` + 서명 인증서 지문(`cert-sha256.txt`)
   - `upload-keystore` — **처음 실행 시에만 생성되는 서명 키** (아래 참고)

### ⚠️ 서명 키 보관 (중요, 최초 1회)

첫 빌드에서 서명 키(`upload.jks`)와 비밀번호(`keystore-password.txt`)가 자동 생성되어 `upload-keystore` 아티팩트로 제공됩니다. 앱 업데이트 때마다 같은 키가 필요하므로:

1. `upload-keystore` 아티팩트를 내려받아 안전한 곳에 보관
2. 저장소 **Settings → Secrets and variables → Actions**에 시크릿 2개 등록:
   - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 upload.jks` 결과 (Mac은 `base64 -i upload.jks`)
   - `ANDROID_KEYSTORE_PASSWORD` — `keystore-password.txt`의 내용
3. **등록 후 GitHub의 `upload-keystore` 아티팩트를 삭제** (공개 저장소에서는 누구나 아티팩트를 받을 수 있으므로 반드시 삭제할 것. 아티팩트는 3일 후 자동 만료되지만 즉시 삭제 권장)

이후 빌드부터는 시크릿의 키로 서명됩니다. Play App Signing을 사용하므로 만약 키를 분실해도 Google 지원을 통해 업로드 키를 재설정할 수 있습니다.

## 2. Play Console 계정 및 앱 생성

1. [Play Console](https://play.google.com/console)에서 개발자 계정 등록 — **$25 (1회)**
2. **앱 만들기** → 앱 이름 "녹음 & 전사", 기본 언어 한국어, 앱(무료) 선택
3. 업로드 시 **Play App Signing**(Google이 서명 키 관리)을 기본값 그대로 사용

> 💡 **신규 개인 개발자 계정 참고**: 2023년 11월 이후 만든 개인 계정은 프로덕션 출시 전에 **비공개 테스트에서 테스터 12명 이상, 14일 이상** 테스트 요건을 채워야 합니다. 지인들에게 테스터 참여를 요청하세요.

## 3. AAB 업로드 (내부 테스트부터)

1. Play Console → **테스트 → 내부 테스트** → 새 버전 만들기
2. 1단계에서 받은 `app-release.aab` 업로드
3. 테스터 이메일 추가 후 게시 → 받은 링크로 본인 폰에서 설치 테스트

## 4. 디지털 자산 링크 연결 (주소창 제거)

이 단계를 해야 앱이 브라우저 UI 없이 완전한 앱처럼 보입니다.

**중요**: 자산 링크 파일은 도메인 루트인 `https://polarbears78.github.io/.well-known/assetlinks.json` 에서 제공되어야 합니다. 이 저장소는 `/mice/` 하위 경로로 배포되므로, **`polarbears78.github.io` 라는 이름의 저장소를 하나 더 만들어** 거기에 파일을 올려야 합니다 (GitHub 사용자 페이지는 루트로 배포됨).

1. Play Console → **설정(Setup) → 앱 서명(App integrity)** → **앱 서명 키 인증서**의 **SHA-256 인증서 지문** 복사
2. GitHub에서 새 **공개** 저장소 `polarbears78.github.io` 생성 (Settings → Pages에서 main 브랜치 배포 활성화)
3. 그 저장소에 `.well-known/assetlinks.json` 파일 생성 — 이 저장소의 `.well-known/assetlinks.json`을 템플릿으로 복사하고, `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`을 1번에서 복사한 지문으로 교체
   - 내부 테스트 단계에서 주소창이 보이면 `cert-sha256.txt`의 지문(업로드 키)도 배열에 함께 추가
4. `https://polarbears78.github.io/.well-known/assetlinks.json` 이 열리는지 확인하면 연결 완성

## 5. 스토어 등록정보 작성

Play Console의 **앱 콘텐츠**와 **스토어 등록정보**에서 필수 항목 입력:

- **개인정보처리방침 URL**: `https://polarbears78.github.io/mice/privacy.html` (이미 준비됨)
- **스크린샷**: 폰에서 앱 사용 화면 캡처 2장 이상
- **앱 아이콘 512px**: 저장소의 `icons/icon-512.png` 사용 가능
- 데이터 보안 섹션: "데이터를 수집하지 않음" 선택 (이 앱은 아무것도 수집하지 않음)
- 콘텐츠 등급 설문 작성

## 6. 출시

내부 테스트 → 비공개 테스트(신규 계정은 12명/14일 요건) → **프로덕션** 순서로 승격하고 심사를 제출합니다. 심사는 보통 며칠 이내에 완료됩니다.

## 업데이트 방법

- **웹 앱 내용(UI/기능) 변경**: `main`에 푸시만 하면 됩니다. 사이트가 재배포되고 설치된 앱에 즉시 반영됩니다. **Play 재심사 불필요.**
- **안드로이드 껍데기 변경** (앱 이름, 아이콘, URL 등): `android/app/build.gradle`의 `versionCode`를 1 올리고 워크플로를 다시 실행해 새 AAB를 Play Console에 업로드합니다.

## 문제 해결

- **앱 상단에 주소창이 보임** → 4단계의 assetlinks.json이 도메인 루트에 없거나 지문이 잘못된 것. `https://polarbears78.github.io/.well-known/assetlinks.json` 접속해서 내용 확인.
- **빌드 실패** → Actions 로그 확인. 시크릿 등록 후 `ANDROID_KEYSTORE_BASE64` 값이 줄바꿈 없이 한 줄인지 확인 (`base64 -w0`).
