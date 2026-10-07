import { expect, mock, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

type TestOn = Parameters<Parameters<typeof test>[1]>[1]

const SESSION_START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns: 160,
  scroll: { bodyRows: 6, offset: 0, total: 3 },
} as never

const usageAt = (percent: number, extra: Partial<SessionUsage> = {}): SessionUsage => ({
  startedAt: 0,
  context: { window: 200000, percent },
  rateLimits: [],
  ...extra,
})

const turn = (durationMs: number) =>
  ({ answer: '', durationMs, isAborted: false, turnId: 't1', reason: 'answer' }) as const

const recordToasts = (on: TestOn) => {
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return toasts
}

const textElement = (text: string) => ({ type: 'Text', props: {}, children: [text] }) as never

const SWITCH_PANE_PROPS = {
  title: 'status-dash',
  isFocused: false,
  bodyColumns: 60,
  placement: 'inline',
  scroll: { bodyRows: 7, offset: 0, total: 3 },
  view: {},
} as never

const answerSession = (on: TestOn, usage: SessionUsage, store: Record<string, unknown> = {}) => {
  mock.store(on, store)
  on('command.register', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('skill.prompt', () => ({ text: '' }))
  on('session.cwd', () => ({ value: '/Users/user/work/my-project' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: usage }))
  mock.clock(on, { now: 0 })
}

test('긴 턴이 끝나면 완료 토스트를 띄운다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(52))

  await $.turn.complete(turn(72000))

  expect(toasts).toEqual(['✔ 작업 완료 · 1분 12초'])
})

test('짧은 턴에는 토스트를 띄우지 않는다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(10))

  await $.turn.complete(turn(5000))

  expect(toasts).toEqual([])
})

test('대화 용량이 85%를 넘는 순간 한 번만 /compact 토스트를 띄운다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(90))

  await $.session.start(SESSION_START)
  await $.turn.complete(turn(1000))

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('/compact')
})

test('권한 요청 같은 알림은 토스트로 띄운다', async ($, on) => {
  const toasts = recordToasts(on)
  mock.store(on)
  on('classic.Notification', () => ({}))

  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })

  expect(toasts).toEqual(['🔔 Claude needs your permission to use Bash'])
})

test('프롬프트 위 밴드에 대화 용량을 그린다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(75))
  await $.session.start(SESSION_START)

  const ui = await $.ui.mount({
    plugin: 'status-dash',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })

  expect(await ui.find({ text: /대화 용량/ })).toBeDefined()
  expect(await ui.find({ text: /곧 \/compact 권장/ })).toBeDefined()
  expect(await ui.find({ text: /my-project/ })).toBeDefined()
})

test('쓴 스킬이 밴드 첫 줄에 나타난다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(10))
  await $.session.start(SESSION_START)
  await $.skill.prompt({ skill: 'superpowers:brainstorming', text: '' })

  const ui = await $.ui.mount({
    plugin: 'status-dash',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })

  expect(await ui.find({ text: /✦ brainstorming/ })).toBeDefined()
})

test('꺼 두면 완료 토스트를 띄우지 않는다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(52), { enabled: false })

  await $.turn.complete(turn(72000))

  expect(toasts).toEqual([])
})

test('꺼 두면 알림 토스트도 띄우지 않는다', async ($, on) => {
  const toasts = recordToasts(on)
  mock.store(on, { enabled: false })
  on('classic.Notification', () => ({}))

  await $.classic.Notification({ message: 'x', notification_type: 'permission_prompt' })

  expect(toasts).toEqual([])
})

test('꺼 두면 밴드를 그리지 않고 엔진이 그리게 둔다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(75), { enabled: false })
  on('ui.render', () => textElement('engine row'))
  await $.session.start(SESSION_START)

  const ui = await $.ui.mount({ plugin: 'status-dash', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
  expect(await ui.find({ text: /대화 용량/ })).toBeUndefined()
})

test('/status-dash off 로 끄고 on 으로 다시 켠다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(52))

  const off = await $.command.run({ command: 'status-dash', args: 'off' } as never)
  await $.turn.complete(turn(72000))
  const stillQuiet = [...toasts]
  const turnedOn = await $.command.run({ command: 'status-dash', args: 'on' } as never)
  await $.turn.complete(turn(72000))

  expect(off).toMatchObject({ text: 'status-dash 을(를) 껐어요.' })
  expect(stillQuiet).toEqual(['status-dash 을(를) 껐어요.'])
  expect(turnedOn).toMatchObject({ text: 'status-dash 을(를) 켰어요.' })
  expect(toasts.at(-1)).toBe('✔ 작업 완료 · 1분 12초')
})

test('/status-dash status 는 지금 상태를 알려준다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(52), { enabled: false })

  const reply = await $.command.run({ command: 'status-dash', args: 'status' } as never)

  expect(reply).toMatchObject({ text: 'status-dash 은(는) 지금 꺼져 있어요.' })
})

test('잘못된 인자는 사용법을 알려준다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(52))

  const reply = await $.command.run({ command: 'status-dash', args: 'maybe' } as never)

  expect(reply).toMatchObject({ text: expect.stringContaining('/status-dash [on|off|status]') })
})

test('인자 없이 입력하면 켜기/끄기를 고르는 창을 연다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(52))
  const opened: unknown[] = []
  on('ui.open', (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })

  await $.command.run({ command: 'status-dash', args: '' } as never)

  expect(opened).toHaveLength(1)
  expect(opened[0]).toMatchObject({ id: 'status-dash-switch', focus: true, closeOnEscape: true })
})

test('고르는 창에서 끄기를 누르면 꺼지고 창이 닫힌다', async ($, on) => {
  const toasts = recordToasts(on)
  answerSession(on, usageAt(52))
  const closed: unknown[] = []
  on('ui.close', (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.ui.mount({
    plugin: 'status-dash',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'status-dash-switch',
    props: SWITCH_PANE_PROPS,
  })

  await $.ui.press({ plugin: 'status-dash', key: 'off' })
  await $.turn.complete(turn(72000))

  expect(toasts).toEqual(['status-dash 을(를) 껐어요.'])
  expect(closed).toHaveLength(1)
})

test('고르는 창은 지금 상태와 두 선택지를 보여준다', async ($, on) => {
  recordToasts(on)
  answerSession(on, usageAt(52), { enabled: false })
  const ui = await $.ui.mount({
    plugin: 'status-dash',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'status-dash-switch',
    props: SWITCH_PANE_PROPS,
  })

  expect(await ui.find({ text: /꺼져 있어요/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Button' })).map(button => button.props.label)).toEqual(['켜기', '끄기'])
})
