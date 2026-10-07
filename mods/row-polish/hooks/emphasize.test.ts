import { expect, test } from 'claude-code/testing'

import { emphasizeCommands } from './emphasize'

test('슬래시 명령을 코드로 강조하고 뒤따르는 조사는 그대로 둔다', () => {
  expect(emphasizeCommands('/compact를 하세요')).toBe('`/compact`를 하세요')
  expect(emphasizeCommands('먼저 /clear 한 뒤 /mods-demo 를 실행')).toBe('먼저 `/clear` 한 뒤 `/mods-demo` 를 실행')
})

test('claude 명령은 인자까지 한 덩어리로 강조한다', () => {
  expect(emphasizeCommands('claude update 를 실행')).toBe('`claude update` 를 실행')
  expect(emphasizeCommands('claude plugin validate ~/mods/a 로 확인')).toBe('`claude plugin validate ~/mods/a` 로 확인')
  expect(emphasizeCommands('claude --plugin-dir ./x 로 켜기')).toBe('`claude --plugin-dir ./x` 로 켜기')
})

test('명령어가 아닌 단축키, 경로, 식별자는 강조하지 않는다', () => {
  const others = ['ctrl+b 를 누르세요', '~/.claude/mods/row-polish 폴더', 'hooks/register.tsx 수정', 'tool_use_id 로 찾기', '/Users/user/work/ 아래']

  others.forEach(text => expect(emphasizeCommands(text)).toBe(text))
})

test('이미 코드로 표시된 부분은 그대로 둔다', () => {
  expect(emphasizeCommands('`/compact` 는 그대로')).toBe('`/compact` 는 그대로')
})

test('코드 블록 안은 건드리지 않는다', () => {
  const fenced = '설명\n```bash\n/compact\nclaude update\n```\n끝'

  expect(emphasizeCommands(fenced)).toBe(fenced)
})

test('아직 닫히지 않은 코드 블록도 건드리지 않는다', () => {
  const partial = '설명\n```bash\n/compact\nclaude update'

  expect(emphasizeCommands(partial)).toBe(partial)
})

test('링크와 URL은 건드리지 않는다', () => {
  expect(emphasizeCommands('[문서](/docs/start) 참고')).toBe('[문서](/docs/start) 참고')
  expect(emphasizeCommands('https://claude.com/claude-code 에서')).toBe('https://claude.com/claude-code 에서')
})

test('일반 문장은 잘못 강조하지 않는다', () => {
  const sentences = ['및/또는 선택', 'TCP/IP 와 I/O', '하루 24/7 운영', '버전 2.1.292 입니다', 'A/B 테스트', '5시간/주간 한도']

  sentences.forEach(sentence => expect(emphasizeCommands(sentence)).toBe(sentence))
})
