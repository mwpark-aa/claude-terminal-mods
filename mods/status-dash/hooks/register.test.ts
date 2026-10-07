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

const answerSession = (on: TestOn, usage: SessionUsage) => {
  on('session.start', () => ({ cwd: '/tmp' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('skill.prompt', () => ({ text: '' }))
  on('session.cwd', () => ({ value: '/Users/bagmin-u/work/sup-airflow' }))
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
  expect(await ui.find({ text: /sup-airflow/ })).toBeDefined()
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
