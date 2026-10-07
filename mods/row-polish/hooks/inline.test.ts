import { expect, test } from 'claude-code/testing'

import { codeKind, parseInline } from './inline'

test('백틱 안이 명령어 한 개일 때만 명령어로 본다', () => {
  expect(codeKind('/compact')).toBe('command')
  expect(codeKind('claude update')).toBe('command')
  expect(codeKind('claude plugin validate ~/x')).toBe('command')
  expect(codeKind('복사: /compact')).toBe('code')
  expect(codeKind('/Users/user')).toBe('code')
  expect(codeKind('ctrl+b')).toBe('code')
  expect(codeKind('ls -la')).toBe('command')
  expect(codeKind('git status')).toBe('command')
  expect(codeKind('foo bar')).toBe('code')
})

test('문장 속 슬래시 명령을 앞뒤 글자와 분리한다', () => {
  expect(parseInline('/compact 를 하세요')).toEqual([{ text: '/compact', kind: 'command' }, { text: ' 를 하세요' }])
  expect(parseInline('먼저 /clear 한 뒤')).toEqual([
    { text: '먼저 ' },
    { text: '/clear', kind: 'command' },
    { text: ' 한 뒤' },
  ])
})

test('백틱으로 감싼 명령어는 명령어로, 나머지는 코드로 나누고 백틱 정보를 남긴다', () => {
  expect(parseInline('`/compact` 는')).toEqual([{ text: '/compact', kind: 'command', ticks: '`' }, { text: ' 는' }])
  expect(parseInline('`ls -la` 실행')).toEqual([{ text: 'ls -la', kind: 'command', ticks: '`' }, { text: ' 실행' }])
  expect(parseInline('`foo bar` 실행')).toEqual([{ text: 'foo bar', kind: 'code', ticks: '`' }, { text: ' 실행' }])
})

test('백틱 없이 쓴 명령어에는 백틱 정보가 없다', () => {
  expect(parseInline('/compact 를')).toEqual([{ text: '/compact', kind: 'command' }, { text: ' 를' }])
})

test('백틱 안이 문장이면 명령어로 보지 않는다', () => {
  expect(parseInline('`복사: /compact ctrl+b` 같은 줄')).toEqual([
    { text: '복사: /compact ctrl+b', kind: 'code', ticks: '`' },
    { text: ' 같은 줄' },
  ])
})

test('claude 명령은 인자까지 한 덩어리다', () => {
  expect(parseInline('claude update 를 실행')).toEqual([{ text: 'claude update', kind: 'command' }, { text: ' 를 실행' }])
})

test('단축키, 경로, 식별자는 백틱이 없으면 일반 글자로 둔다', () => {
  expect(parseInline('ctrl+b 와 ~/.claude/mods 와 tool_use_id')).toEqual([{ text: 'ctrl+b 와 ~/.claude/mods 와 tool_use_id' }])
})

test('굵게, 기울임, 취소선을 처리한다', () => {
  expect(parseInline('**중요** 합니다')).toEqual([{ text: '중요', bold: true }, { text: ' 합니다' }])
  expect(parseInline('*기울임* 텍스트')).toEqual([{ text: '기울임', italic: true }, { text: ' 텍스트' }])
  expect(parseInline('~~삭제~~')).toEqual([{ text: '삭제', strike: true }])
})

test('굵은 글씨 안의 명령어도 명령어로 본다', () => {
  expect(parseInline('**/compact**')).toEqual([{ text: '/compact', kind: 'command', bold: true }])
})

test('링크와 주소를 처리한다', () => {
  expect(parseInline('[문서](https://a.b/c) 참고')).toEqual([
    { text: '문서', kind: 'link', href: 'https://a.b/c' },
    { text: ' 참고' },
  ])
  expect(parseInline('주소 https://a.b/c 입니다')).toEqual([
    { text: '주소 ' },
    { text: 'https://a.b/c', kind: 'link', href: 'https://a.b/c' },
    { text: ' 입니다' },
  ])
})

test('일반 문장은 하나의 글자 덩어리로 둔다', () => {
  expect(parseInline('평범한 문장')).toEqual([{ text: '평범한 문장' }])
  expect(parseInline('및/또는 선택, TCP/IP, 24/7')).toEqual([{ text: '및/또는 선택, TCP/IP, 24/7' }])
})
