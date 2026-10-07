import { expect, mock, test as baseTest } from 'claude-code/testing'

type Body = Extract<Parameters<typeof baseTest>[1], (...args: never[]) => unknown>
type TestOn = Parameters<Body>[1]

const test = (name: string, body: Body) =>
  baseTest(name, ($, on) => {
    mock.store(on)

    return body($, on)
  })

const textElement = (text: string) => ({ type: 'Text', props: {}, children: [text] }) as never

const drawEnginesOwnProps = (on: TestOn, pick: (props: Record<string, unknown>) => string) =>
  on('ui.render', (_$, e) => textElement(pick(e.props as Record<string, unknown>)))

const BASH_ROW = {
  tool_use_id: 'tu1',
  tool: 'Bash',
  input: { command: 'ls -la', description: '파일 목록 보기' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
}

const mountBashRow = ($: Parameters<Body>[0], props: object) =>
  $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, ...props } as never,
  })

test('스피너 문구가 한글로 바뀐다', async ($, on) => {
  drawEnginesOwnProps(on, props => String(props.word))

  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'Spinner',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
  })

  expect(await ui.find({ text: '생각 중' })).toBeDefined()
})

test('백그라운드 안내가 한글로 바뀐다', async ($, on) => {
  drawEnginesOwnProps(on, props => String(props.hint))

  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'ToolProgress',
    props: { tool_use_id: 'tu1', kind: 'background_hint', hint: '(ctrl+b to run in background)' },
  })

  expect(await ui.find({ text: '(ctrl+b: 백그라운드 실행)' })).toBeDefined()
})

test('턴 종료 줄이 한글로 그려진다', async ($) => {
  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'TurnDuration',
    props: { word: 'Baked', durationMs: 64000 },
  })

  expect(await ui.find({ text: /1분 4초 만에 완료/ })).toBeDefined()
})

test('Bash 줄에 설명과 하이라이트된 명령어 블록을 그린다', async ($) => {
  const ui = await mountBashRow($, {})

  expect(await ui.find({ text: /파일 목록 보기/ })).toBeDefined()
  expect(await ui.find({ type: 'Code', text: /ls -la/ })).toBeDefined()
})

test('실패한 Bash 줄에는 실패 표시가 붙는다', async ($) => {
  const ui = await mountBashRow($, { isErrored: true })

  expect(await ui.find({ text: /실패/ })).toBeDefined()
})

test('명령어가 없는 입력은 엔진이 그리게 둔다', async ($, on) => {
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountBashRow($, { input: {} })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

test('Bash가 끝나면 걸린 시간을 줄에 보여준다', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let calledId = ''
  on('tool.call', async (_$, e) => {
    calledId = e.tool_use_id
    await clock.advance(2300)
    return { result: { stdout: '', stderr: '', interrupted: false }, text: '', isError: false } as never
  })

  await $.tool.call({ tool: 'Bash', command: 'ls -la' } as never)

  const ui = await mountBashRow($, { tool_use_id: calledId })

  expect(await ui.find({ text: /2\.3초/ })).toBeDefined()
})

const mountAssistantMessage = ($: Parameters<Body>[0], text: string, props: object = {}) =>
  $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true, ...props } as never,
  })

test('답변 속 슬래시 명령이 하늘색 굵은 글씨로 그려진다', async ($) => {
  const ui = await mountAssistantMessage($, '/compact 를 하세요')
  const command = await ui.find({ type: 'Text', text: /^\/compact$/ })

  expect(command?.props.color).toBe('#7dd3fc')
  expect(command?.props.bold).toBe(true)
  expect(command?.props.backgroundColor).toBeUndefined()
})

test('claude 명령도 슬래시 명령과 같은 스타일로 그려진다', async ($) => {
  const ui = await mountAssistantMessage($, 'claude update 를 실행')
  const command = await ui.find({ type: 'Text', text: /^claude update$/ })

  expect(command?.props.color).toBe('#7dd3fc')
  expect(command?.props.bold).toBe(true)
})

test('백틱으로 쓴 셸 명령도 명령어 스타일로 그려지고 백틱이 남는다', async ($) => {
  const ui = await mountAssistantMessage($, '`ls -la` 를 실행하세요')
  const command = await ui.find({ type: 'Text', text: /^`ls -la`$/ })

  expect(command?.props.color).toBe('#7dd3fc')
  expect(command?.props.bold).toBe(true)
})

test('명령어가 아닌 백틱 코드는 백틱이 남고 배경 없는 연한 회색으로 그려진다', async ($) => {
  const ui = await mountAssistantMessage($, '`foo bar` 와 /compact')
  const code = await ui.find({ type: 'Text', text: /^`foo bar`$/ })

  expect(code?.props.color).toBe('#cbd5e1')
  expect(code?.props.backgroundColor).toBeUndefined()
})

test('백틱 없이 쓴 명령어에는 백틱을 붙이지 않는다', async ($) => {
  const ui = await mountAssistantMessage($, '/compact 를 하세요')

  expect(await ui.find({ type: 'Text', text: /^\/compact$/ })).toBeDefined()
})

test('명령어가 아닌 단축키와 경로는 색을 입히지 않는다', async ($) => {
  const ui = await mountAssistantMessage($, '/compact 와 ctrl+b 와 ~/.claude/mods')

  expect(await ui.find({ type: 'Text', text: /^ctrl\+b$/ })).toBeUndefined()
})

test('명령어가 없는 답변은 엔진이 그리게 둔다', async ($, on) => {
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountAssistantMessage($, '`foo bar` 와 ctrl+b 만 있어요')

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

test('코드 블록과 목록과 굵은 글씨가 섞인 답변도 그려진다', async ($) => {
  const ui = await mountAssistantMessage($, '# 제목\n\n- **굵게** `/clear` 항목\n\n```bash\nls -la\n```\n끝')

  expect(await ui.find({ type: 'Code', text: /ls -la/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^`\/clear`$/ }))?.props.color).toBe('#7dd3fc')
})

test('표가 있는 답변은 표를 마크다운으로 그린다', async ($) => {
  const ui = await mountAssistantMessage($, '/compact 확인\n\n| a | b |\n|---|---|\n| 1 | 2 |')

  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
})

test('지원하지 않는 마크다운이 섞이면 코드 스타일 마크다운으로 그린다', async ($) => {
  const ui = await mountAssistantMessage($, '![그림](a.png) 그리고 /compact')

  expect(await ui.find({ type: 'Markdown', text: /`\/compact`/ })).toBeDefined()
})

test('강조할 명령어가 없는 답변은 엔진이 그리게 둔다', async ($, on) => {
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountAssistantMessage($, '평범한 문장입니다')

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

test('요약 블록은 건드리지 않는다', async ($, on) => {
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountAssistantMessage($, '/compact 를 하세요', { isSummary: true })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

const mountToolRow = ($: Parameters<Body>[0], tool: string, input: object, extra: object = {}) =>
  $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: `tu-${tool}`,
      tool,
      input,
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      ...extra,
    } as never,
  })

test('Read 줄은 회청색 이름과 흐린 폴더 줄로 그려진다', async ($) => {
  const output = { type: 'text', file: { filePath: '/x', content: '', numLines: 120, startLine: 1, totalLines: 120 } }
  const ui = await mountToolRow($, 'Read', { file_path: '/Users/user/.claude/mods/view.tsx' }, { output })

  expect((await ui.find({ type: 'Text', text: 'Read' }))?.props.color).toBe('#94a3b8')
  expect(await ui.find({ type: 'Text', text: /view\.tsx/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /120줄/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /~\/\.claude\/mods\// }))?.props.dimColor).toBe(true)
})

test('Edit 줄은 보라색 이름과 늘고 준 줄 수로 그려진다', async ($) => {
  const output = { structuredPatch: [{ lines: ['-a', '+b', '+c'] }] }
  const ui = await mountToolRow($, 'Edit', { file_path: '/a/palette.ts' }, { output })

  expect((await ui.find({ type: 'Text', text: 'Edit' }))?.props.color).toBe('#c4b5fd')
  expect((await ui.find({ type: 'Text', text: /\+2/ }))?.props.color).toBe('success')
  expect((await ui.find({ type: 'Text', text: /−1/ }))?.props.color).toBe('error')
})

test('Write 줄은 청록색 이름과 새 파일 표시로 그려진다', async ($) => {
  const output = { type: 'create', content: 'a\nb\n' }
  const ui = await mountToolRow($, 'Write', { file_path: '/a/format.ts' }, { output })

  expect((await ui.find({ type: 'Text', text: 'Write' }))?.props.color).toBe('#67e8f9')
  expect(await ui.find({ type: 'Text', text: /새 파일 · 2줄/ })).toBeDefined()
})

test('실패한 파일 줄에는 상태 색과 실패 표시가 붙는다', async ($) => {
  const ui = await mountToolRow($, 'Edit', { file_path: '/a/b.ts' }, { isErrored: true })

  expect((await ui.find({ type: 'Text', text: /실패/ }))?.props.color).toBe('error')
})

test('작업 이름 색은 상태 색과 겹치지 않는다', async ($) => {
  const ui = await mountToolRow($, 'Read', { file_path: '/a' }, { isErrored: true })

  expect((await ui.find({ type: 'Text', text: 'Read' }))?.props.color).not.toBe('error')
})

test('삭제 명령을 실행하는 Bash 줄은 분홍색 이름으로 그려진다', async ($) => {
  const ui = await mountToolRow($, 'Bash', { command: 'rm -rf /tmp/old', description: '임시 파일 삭제' })

  expect((await ui.find({ type: 'Text', text: /^\s*Bash\s*$/ }))?.props.color).toBe('#f9a8d4')
})

test('삭제가 아닌 Bash 줄의 이름에는 삭제 색을 입히지 않는다', async ($) => {
  const ui = await mountToolRow($, 'Bash', { command: 'ls -la' })

  expect((await ui.find({ type: 'Text', text: /^\s*Bash\s*$/ }))?.props.color).toBeUndefined()
})

test('파일 경로가 없는 Read는 엔진이 그리게 둔다', async ($, on) => {
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountToolRow($, 'Read', {})

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})


const SWITCH_PANE_PROPS = {
  title: 'row-polish',
  isFocused: false,
  bodyColumns: 60,
  placement: 'inline',
  scroll: { bodyRows: 7, offset: 0, total: 3 },
  view: {},
} as never

const answerCommandWorld = (on: TestOn) => {
  on('command.register', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return toasts
}

baseTest('꺼 두면 스피너 문구를 엔진 그대로 둔다', async ($, on) => {
  mock.store(on, { enabled: false })
  drawEnginesOwnProps(on, props => String(props.word))

  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'Spinner',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
  })

  expect(await ui.find({ text: 'Sauteing' })).toBeDefined()
})

baseTest('꺼 두면 턴 종료 줄을 엔진이 그리게 둔다', async ($, on) => {
  mock.store(on, { enabled: false })
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'TurnDuration',
    props: { word: 'Baked', durationMs: 64000 },
  })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

baseTest('꺼 두면 답변 속 명령어를 직접 그리지 않는다', async ($, on) => {
  mock.store(on, { enabled: false })
  drawEnginesOwnProps(on, () => 'engine row')

  const ui = await mountAssistantMessage($, '/compact 를 하세요')

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
})

baseTest('꺼 두면 Bash 줄과 파일 줄도 엔진이 그리게 둔다', async ($, on) => {
  mock.store(on, { enabled: false })
  drawEnginesOwnProps(on, () => 'engine row')

  const bash = await mountToolRow($, 'Bash', { command: 'ls -la' })

  expect(await bash.find({ text: 'engine row' })).toBeDefined()
})

test('/row-polish off 로 끄고 on 으로 다시 켠다', async ($, on) => {
  const toasts = answerCommandWorld(on)
  drawEnginesOwnProps(on, props => String(props.word))

  const off = await $.command.run({ command: 'row-polish', args: 'off' } as never)
  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'Spinner',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
  })

  expect(off).toMatchObject({ text: 'row-polish 을(를) 껐어요.' })
  expect(toasts).toEqual(['row-polish 을(를) 껐어요.'])
  expect(await ui.find({ text: 'Sauteing' })).toBeDefined()
})

test('/row-polish on 은 다시 켜서 한글 스피너가 돌아온다', async ($, on) => {
  answerCommandWorld(on)
  drawEnginesOwnProps(on, props => String(props.word))
  await $.command.run({ command: 'row-polish', args: 'off' } as never)

  const turnedOn = await $.command.run({ command: 'row-polish', args: 'on' } as never)
  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'Spinner',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
  })

  expect(turnedOn).toMatchObject({ text: 'row-polish 을(를) 켰어요.' })
  expect(await ui.find({ text: '생각 중' })).toBeDefined()
})

test('/row-polish status 와 잘못된 인자를 안내한다', async ($, on) => {
  answerCommandWorld(on)

  const status = await $.command.run({ command: 'row-polish', args: 'status' } as never)
  const invalid = await $.command.run({ command: 'row-polish', args: 'maybe' } as never)

  expect(status).toMatchObject({ text: 'row-polish 은(는) 지금 켜져 있어요.' })
  expect(invalid).toMatchObject({ text: expect.stringContaining('/row-polish [on|off|status]') })
})

test('인자 없이 입력하면 켜기/끄기를 고르는 창을 연다', async ($, on) => {
  answerCommandWorld(on)
  const opened: unknown[] = []
  on('ui.open', (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })

  await $.command.run({ command: 'row-polish', args: '' } as never)

  expect(opened[0]).toMatchObject({ id: 'row-polish-switch', focus: true, closeOnEscape: true })
})

test('고르는 창은 두 선택지를 보여주고 끄기를 누르면 꺼지고 닫힌다', async ($, on) => {
  const toasts = answerCommandWorld(on)
  const closed: unknown[] = []
  on('ui.close', (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  const ui = await $.ui.mount({
    plugin: 'row-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'row-polish-switch',
    props: SWITCH_PANE_PROPS,
  })

  expect((await ui.findAll({ type: 'Button' })).map(button => button.props.label)).toEqual(['켜기', '끄기'])

  await $.ui.press({ plugin: 'row-polish', key: 'off' })

  expect(toasts).toEqual(['row-polish 을(를) 껐어요.'])
  expect(closed).toHaveLength(1)
})
