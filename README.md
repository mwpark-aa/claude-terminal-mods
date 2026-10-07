# Claude Code 터미널 모드 모음

Claude Code 터미널 화면을 한글로, 더 읽기 좋게 바꿔 주는 모드 두 개입니다.

| 모드 | 하는 일 |
|---|---|
| `status-dash` | 입력창 위 대시보드(모델, 폴더, 최근 쓴 스킬, 대화 용량·5시간·주간 한도 게이지와 초기화까지 남은 시간), 작업 완료·권한 요청·대화 용량 경고 토스트 |
| `row-polish` | 스피너·턴 종료 줄·백그라운드 안내 한글화, Bash 줄(상태, 설명, 소요 시간, 하이라이트된 명령어), Read·Edit·Write·삭제 줄(작업별 색), 답변 속 명령어(`/compact`, `claude …`, 셸 명령) 강조 |

## 설치

Claude Code 터미널 세션에서 입력합니다.

```
/plugin install status-dash --marketplace mwpark-aa/claude-terminal-mods
/plugin install row-polish --marketplace mwpark-aa/claude-terminal-mods
```

처음 한 번 마켓플레이스 추가를 묻는데 `y`를 누르고, 범위(user 등)를 고르면 설치와 동시에 적용됩니다. 이후 세션에서도 유지됩니다.

직접 내려받아 쓰려면 이렇게 실행합니다.

```
git clone https://github.com/mwpark-aa/claude-terminal-mods
claude --plugin-dir ./claude-terminal-mods/mods/status-dash --plugin-dir ./claude-terminal-mods/mods/row-polish
```

## 알아두세요

- Claude Code의 모드(함수 훅 플러그인) API는 **초기 단계**입니다. 버전이 올라가면 동작이 바뀌거나 깨질 수 있습니다. 2.1.29x 버전에서 만들고 시험했습니다.
- 화면 문구는 한글이고, 색은 어두운 터미널을 기준으로 골랐습니다.
- 5시간·주간 한도 게이지는 구독 계정에서만 나옵니다.
- 데스크톱 앱의 Code 탭에서는 `/plugin install`을 쓸 수 없습니다. 터미널에서 설치한 뒤에 쓰세요.
- 두 모드 모두 화면을 그리는 용도이고, 파일을 읽거나 쓰거나 외부로 보내지 않습니다.

## 개발

각 모드 폴더에서 검증하고 시험할 수 있습니다.

```
claude plugin validate mods/status-dash
claude plugin test mods/status-dash
claude plugin validate mods/row-polish
claude plugin test mods/row-polish
```

## 라이선스

MIT
