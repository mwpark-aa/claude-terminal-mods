import { expect, test } from 'claude-code/testing'

import { hasStyledSpans, hasUnsupportedMarkdown, parseBlocks } from './blocks'
import { planMessage } from './plan'

const lineOf = (text: string) => {
  const [block] = parseBlocks(text)

  return block.kind === 'line' ? block.line : undefined
}

test('제목, 목록, 번호, 체크박스, 인용, 구분선을 구분한다', () => {
  expect(lineOf('# 제목')).toEqual({ type: 'heading', level: 1, spans: [{ text: '제목' }] })
  expect(lineOf('- 항목')).toEqual({ type: 'bullet', indent: 0, marker: '•', spans: [{ text: '항목' }] })
  expect(lineOf('  - 하위')).toEqual({ type: 'bullet', indent: 2, marker: '◦', spans: [{ text: '하위' }] })
  expect(lineOf('1. 하나')).toEqual({ type: 'ordered', indent: 0, marker: '1.', spans: [{ text: '하나' }] })
  expect(lineOf('- [x] 완료')).toEqual({ type: 'bullet', indent: 0, marker: '☑', spans: [{ text: '완료' }] })
  expect(lineOf('- [ ] 할 일')).toEqual({ type: 'bullet', indent: 0, marker: '☐', spans: [{ text: '할 일' }] })
  expect(lineOf('> 인용')).toEqual({ type: 'quote', spans: [{ text: '인용' }] })
  expect(lineOf('---')).toEqual({ type: 'rule' })
})

test('굵은 글씨로 시작하는 줄을 목록으로 착각하지 않는다', () => {
  expect(lineOf('**굵게** 시작')?.type).toBe('text')
})

test('코드 블록을 언어와 함께 읽는다', () => {
  expect(parseBlocks('```bash\nls -la\n```')).toEqual([{ kind: 'code', language: 'bash', source: 'ls -la' }])
})

test('아직 닫히지 않은 코드 블록도 읽고 내용이 없으면 버린다', () => {
  expect(parseBlocks('```bash\nls')).toEqual([{ kind: 'code', language: 'bash', source: 'ls' }])
  expect(parseBlocks('```bash')).toEqual([])
})

test('코드 블록 뒤의 글은 다시 일반 글로 읽는다', () => {
  const blocks = parseBlocks('```\na\n```\n끝')

  expect(blocks).toHaveLength(2)
  expect(blocks[1]).toEqual({ kind: 'line', line: { type: 'text', indent: 0, spans: [{ text: '끝' }] } })
})

test('표는 마크다운 그대로 한 블록으로 둔다', () => {
  const table = '| a | b |\n|---|---|\n| 1 | 2 |'

  expect(parseBlocks(table)).toEqual([{ kind: 'table', text: table }])
})

test('이어지는 일반 줄은 한 문단으로 합치고 빈 줄은 문단을 나눈다', () => {
  expect(parseBlocks('첫 줄\n둘째 줄')).toEqual([
    { kind: 'line', line: { type: 'text', indent: 0, spans: [{ text: '첫 줄' }, { text: ' ' }, { text: '둘째 줄' }] } },
  ])
  expect(parseBlocks('가\n\n나').map(block => (block.kind === 'line' ? block.line.type : block.kind))).toEqual([
    'text',
    'blank',
    'text',
  ])
})

test('지원하지 않는 마크다운을 알아본다', () => {
  expect(hasUnsupportedMarkdown('![그림](a.png)')).toBe(true)
  expect(hasUnsupportedMarkdown('<div>내용</div>')).toBe(true)
  expect(hasUnsupportedMarkdown('각주[^1] 입니다')).toBe(true)
  expect(hasUnsupportedMarkdown('제목\n===')).toBe(true)
})

test('코드 안의 꺾쇠나 코드 블록 안의 태그는 지원 불가로 보지 않는다', () => {
  expect(hasUnsupportedMarkdown('`List<String>` 타입')).toBe(false)
  expect(hasUnsupportedMarkdown('```html\n<div>x</div>\n```')).toBe(false)
  expect(hasUnsupportedMarkdown('평범한 문장')).toBe(false)
})

test('명령어가 있는 메시지만 직접 그릴 대상으로 본다', () => {
  expect(hasStyledSpans(parseBlocks('/compact 를 하세요'))).toBe(true)
  expect(hasStyledSpans(parseBlocks('`ls -la` 가 있는 문장'))).toBe(true)
  expect(hasStyledSpans(parseBlocks('`foo bar` 만 있는 문장'))).toBe(false)
  expect(hasStyledSpans(parseBlocks('**굵게** 만 있는 문장'))).toBe(false)
  expect(hasStyledSpans(parseBlocks('[링크](https://a.b) 만 있는 문장'))).toBe(false)
  expect(hasStyledSpans(parseBlocks('ctrl+b 와 ~/.claude/mods'))).toBe(false)
})

test('메시지를 어떻게 그릴지 계획한다', () => {
  expect(planMessage('평범한 문장입니다').mode).toBe('engine')
  expect(planMessage('`foo bar` 와 ctrl+b').mode).toBe('engine')
  expect(planMessage('/compact 를 하세요').mode).toBe('custom')
  expect(planMessage('`ls -la` 와 /compact').mode).toBe('custom')
  expect(planMessage('`git status` 만 있어요').mode).toBe('custom')
  expect(planMessage('![x](y) 와 /compact').mode).toBe('markdown')
  expect(planMessage('![x](y) 평범한 문장').mode).toBe('engine')
})

const LONG_ANSWER = [
  '명령어를 직접 그리는 기능을 넣었습니다. `validate`와 테스트가 통과했습니다.',
  '',
  '**문장 속 색**',
  '',
  '| 종류 | 색 |',
  '|---|---|',
  '| 슬래시 명령(`/compact`) | 하늘색 |',
  '| 단축키(`ctrl+b`) | 노랑 |',
  '',
  '- 백틱으로 감싼 것도, 백틱 없이 쓴 명령어도 같은 색으로 나옵니다.',
  '- 명령어가 있는 메시지 아래에 `복사: /compact ctrl+b` 같은 줄이 붙습니다.',
  '',
  '이 문장에는 `/compact`나 `ctrl+b` 같은 명령어를 일부러 넣어 두었습니다.',
].join('\n')

test('표와 목록이 섞인 긴 답변도 직접 그리는 대상이 된다', () => {
  expect(planMessage(LONG_ANSWER).mode).toBe('custom')
})
