import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, TurnCompleteInput } from 'claude-code'

import type { Snapshot } from '../types'
import {
  COMPACT_URGENT_PERCENT,
  SEPARATOR,
  bandRows,
  folderName,
  formatDuration,
  gaugeCells,
  gradientColor,
  percentText,
  rememberSkill,
} from './format'
import type { BandRow, GaugeSegment } from './format'
import {
  CHANGE_TOAST_MS,
  ENABLED_KEY,
  changedText,
  parseSwitchArgs,
  stateText,
  switchPaneId,
  usageText,
} from './switch'
import { createSwitchView } from './switchView'

const NAME = 'status-dash'
const SWITCH_PANE = switchPaneId(NAME)
const REFRESH_INTERVAL_MS = 5000
const LONG_TURN_MS = 30000
const NOTIFICATION_TOAST_MS = 8000

const snapshotAtom = atom({ plugin: 'status-dash', key: 'snapshot' } as const, null)
const skillsAtom = atom({ plugin: 'status-dash', key: 'skills' } as const, [])

const captureSnapshot = async ($: EngineInterface): Promise<Snapshot> => {
  const [model, cwd, usage, capturedAt] = await Promise.all([
    $.session.model(),
    $.session.cwd(),
    $.session.usage(),
    $.clock.now(),
  ])

  return {
    model,
    folder: folderName(cwd),
    contextPercent: usage.context.percent ?? 0,
    limits: usage.rateLimits,
    capturedAt,
  }
}

const turnToastText = (e: TurnCompleteInput) => {
  if (e.agentId !== undefined || e.isAborted) {
    return undefined
  }

  if (e.reason === 'error') {
    return '✖ 오류로 작업이 중단됐어요'
  }

  return e.durationMs >= LONG_TURN_MS
    ? `✔ 작업 완료 · ${formatDuration(e.durationMs)}`
    : undefined
}

const announceTurn = ($: EngineInterface, e: TurnCompleteInput) => {
  const text = turnToastText(e)

  if (text !== undefined) {
    $.ui.toast(text)
  }
}

let wasUrgent = false

const warnWhenContextBecomesUrgent = ($: EngineInterface, snapshot: Snapshot) => {
  const isUrgent = snapshot.contextPercent >= COMPACT_URGENT_PERCENT

  if (isUrgent && !wasUrgent) {
    $.ui.toast('⚠ 대화 용량이 거의 찼어요. /compact 를 해주세요', { timeoutMs: NOTIFICATION_TOAST_MS })
  }

  wasUrgent = isUrgent
}

const refreshSnapshot = async ($: EngineInterface) => {
  const snapshot = await captureSnapshot($)

  await update($, snapshotAtom, () => snapshot)
  warnWhenContextBecomesUrgent($, snapshot)
}

const refreshSnapshotQuietly = ($: EngineInterface) =>
  refreshSnapshot($).catch(() => undefined)

const readEnabled = async ($: EngineInterface) => (await $.store.get(ENABLED_KEY)) !== false

const applyEnabled = async ($: EngineInterface, isEnabled: boolean) => {
  await $.store.set(ENABLED_KEY, isEnabled)
  $.ui.invalidate('ui.render')
  $.ui.toast(changedText(NAME, isEnabled), { timeoutMs: CHANGE_TOAST_MS })
}

const openChoice = async ($: EngineInterface) => {
  await $.ui.open({ id: SWITCH_PANE, title: NAME, focus: true, closeOnEscape: true, rows: 7 })

  return { text: `${NAME} 켜기/끄기를 선택하세요.` }
}

const runSwitch = async ($: EngineInterface, args: string): Promise<{ text: string }> => {
  const action = parseSwitchArgs(args)

  if (action === 'ask') {
    return openChoice($)
  }

  if (action === 'status') {
    return { text: stateText(NAME, await readEnabled($)) }
  }

  if (action === 'invalid') {
    return { text: usageText(NAME) }
  }

  await applyEnabled($, action === 'on')

  return { text: changedText(NAME, action === 'on') }
}

const refreshWhenEnabled = async ($: EngineInterface) => {
  if (await readEnabled($)) {
    await refreshSnapshotQuietly($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    await $.command.register({
      name: NAME,
      description: '대시보드와 토스트 켜기/끄기',
      argumentHint: '[on|off|status]',
    })
    await refreshWhenEnabled($)
    $.clock.every(REFRESH_INTERVAL_MS, () => void refreshWhenEnabled($))

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, skillsAtom, () => [])
    }

    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    await update($, skillsAtom, used => rememberSkill(used, e.skill))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (await readEnabled($)) {
      announceTurn($, e)
      await refreshSnapshotQuietly($)
    }

    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    if (await readEnabled($)) {
      $.ui.toast(`🔔 ${e.message}`, { timeoutMs: NOTIFICATION_TOAST_MS })
    }

    return next(e)
  })

  on('command.run', { command: NAME }, ($, e) => runSwitch($, e.args))

  on('ui.render', { component: 'Pane', requestId: SWITCH_PANE }, async ($, e) => {
    const isEnabled = await readEnabled($)
    const { switchView } = createSwitchView($.ui.resolve(e))

    const choose = async (next: boolean) => {
      await applyEnabled($, next)
      await $.ui.close({ id: SWITCH_PANE })
    }

    return switchView(NAME, isEnabled, choose)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snapshot = await read($, snapshotAtom)
    const used = await read($, skillsAtom)

    if (!(await readEnabled($)) || e.props.hasSurvey || snapshot === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    const cellView = (glyph: string, color?: string) =>
      color === undefined ? <Text dimColor>{glyph}</Text> : <Text color={color}>{glyph}</Text>

    const gaugeView = (segment: GaugeSegment) => (
      <Box>
        <Text dimColor>{`${segment.label} `}</Text>
        {gaugeCells(segment.percent).map(cell => cellView(cell.glyph, cell.color))}
        <Text color={gradientColor(segment.percent)}>{` ${percentText(segment.percent)}`}</Text>
        {segment.note !== undefined && <Text dimColor>{` · ${segment.note}`}</Text>}
      </Box>
    )

    const partView = (part: string, index: number) => (
      <Box>
        {index > 0 && <Text dimColor>{SEPARATOR}</Text>}
        {index === 0 ? <Text bold>{part}</Text> : <Text>{part}</Text>}
      </Box>
    )

    const rowView = (row: BandRow) => (
      <Box>
        {row.parts.map(partView)}
        {row.segments.map(gaugeView)}
      </Box>
    )

    return <Box flexDirection="column">{bandRows(snapshot, used, e.props.bodyColumns).map(rowView)}</Box>
  })
}
