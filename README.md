# Character Todo

![Platform](https://img.shields.io/badge/platform-Windows%2011-0078D4?style=for-the-badge&logo=windows11&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Status](https://img.shields.io/badge/status-active-5BBF8D?style=for-the-badge)
![Private](https://img.shields.io/badge/repository-private-6E40C9?style=for-the-badge&logo=github)

복어 캐릭터가 바탕화면 위에서 함께 움직이는 Windows 데스크톱 할일 위젯입니다.

**개발자:** Gogo Lebi

## 특징

- Windows 바탕화면 위에 떠 있는 캐릭터형 할일 위젯
- 다른 프로그램을 클릭하면 일반 창처럼 뒤로 내려가 작업을 방해하지 않음
- 캐릭터 클릭으로 할일창 열기/닫기
- 캐릭터를 마우스로 드래그해 바탕화면 어디든 이동
- 할일 추가, 수정, 삭제, 완료 체크 지원
- 완료 체크 시 효과음과 파티클 애니메이션 실행
- 완료 직후 짧은 시간 동안 실행 취소 가능
- 완료한 일 보기에서 취소선이 적용된 완료 목록 확인
- 완료한 일도 목록에서 삭제 가능
- 마감 날짜/시간 설정 가능
- 마감이 지난 할일이 있으면 화난 복어로 바뀌고 덜덜 떨림
- 할일이 있으면 배가 부푼 복어, 할일이 없으면 날씬한 복어로 자동 전환
- 둥실둥실 움직임과 눈 깜빡임 애니메이션 적용

## 설치 및 실행

### 1. Node.js 설치

Node.js가 설치되어 있어야 합니다.

```powershell
node --version
npm --version
```

### 2. 저장소 받기

```powershell
git clone https://github.com/cybereun/character-todo.git
cd character-todo
```

### 3. 앱 실행

```powershell
npm run start
```

`run-app.ps1`은 로컬 `node_modules`에 Electron이 있으면 그것을 사용합니다. 없으면 `C:\tmp\character-todo-runtime`에 Electron 런타임을 설치한 뒤 앱을 실행합니다.

### 4. 문법 검사

```powershell
npm run lint:js
```

## 릴리즈 노트

### v1.0.2

- 설치된 앱이 Windows에서 관리자 권한을 요구하지 않도록 실행 권한을 현재 사용자 권한으로 명시했습니다.
- 기존 설치본에 남을 수 있는 Windows 호환성 레이어의 관리자 실행 플래그를 설치/제거 시 정리합니다.
- 앱 창이 다른 창 뒤로 내려간 뒤에도 다시 찾을 수 있도록 작업 표시줄 표시를 활성화했습니다.

### v1.0.1

- 앱 창이 모든 프로그램 위에 계속 고정되지 않도록 변경했습니다.
- 다른 프로그램을 클릭하면 Character Todo 창이 일반 창처럼 뒤로 내려갑니다.

## 프로젝트 구조

```text
assets/          캐릭터 이미지 자산
src/main.js      Electron 메인 프로세스
src/preload.js   안전한 IPC 브리지
src/index.html   앱 UI
src/styles.css   위젯, 캐릭터, 할일창 스타일
src/renderer.js  할일/완료/마감/드래그 UI 로직
run-app.ps1      Windows 실행 스크립트
```

## 라이선스

개인 프로젝트입니다.
