import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { describeFileRow, isDeleteCommand } from './files'
import {
  formatDuration,
  formatElapsed,
  localizeBackgroundHint,
  readBashInput,
  rowStatus,
  spinnerWord,
  withDuration,
} from './format'
import { ACTION_COLORS } from './palette'
import { planMessage } from './plan'
import { createFileRowView } from './rows'
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
import { createMessageView } from './view'

const NAME = 'row-polish'
const SWITCH_PANE = switchPaneId(NAME)

const durationsAtom = atom({ plugin: 'row-polish', key: 'durations' } as const, {})

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

const recordDuration = ($: EngineInterface, id: string, ms: number) =>
  update($, durationsAtom, durations => withDuration(durations, id, ms))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: '한글 스피너, 도구 줄, 명령어 강조 켜기/끄기',
      argumentHint: '[on|off|status]',
    })

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

  on('ui.render', { component: 'Spinner' }, async ($, e, next) =>
    (await readEnabled($))
      ? next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode) } })
      : next(e),
  )

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) =>
    (await readEnabled($))
      ? next({ ...e, props: { ...e.props, hint: localizeBackgroundHint(e.props.hint) } })
      : next(e),
  )

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (!(await readEnabled($))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color="success">✔</Text>
        <Text dimColor>{` ${formatDuration(e.props.durationMs)} 만에 완료`}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const plan = planMessage(e.props.text)

    if (e.props.isSummary || plan.mode === 'engine' || !(await readEnabled($))) {
      return next(e)
    }

    const view = createMessageView($.ui.resolve(e))

    return plan.mode === 'markdown'
      ? view.markdownMessage(plan.text, e.props.isFirstOfReply)
      : view.customMessage(plan.blocks, e.props.isFirstOfReply)
  })

  on('tool.call', { tool: ['Bash', 'Read', 'Edit', 'Write'] }, async ($, e, next) => {
    const startedAt = await $.clock.now()
    const ran = await next(e)

    await recordDuration($, e.tool_use_id, (await $.clock.now()) - startedAt)

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse', props: { tool: 'Bash' } }, async ($, e, next) => {
    const bash = readBashInput(e.props.input)

    if (bash === undefined || !(await readEnabled($))) {
      return next(e)
    }

    const durations = await read($, durationsAtom)
    const { Box, Text, Code } = $.ui.resolve(e)
    const status = rowStatus(e.props)
    const elapsed = durations[e.props.tool_use_id]

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={status.color}>{`${status.icon} `}</Text>
          <Text bold {...(isDeleteCommand(bash.command) ? { color: ACTION_COLORS.delete } : {})}>
            Bash
          </Text>
          {bash.description !== undefined && <Text dimColor>{` · ${bash.description}`}</Text>}
          {bash.isBackground && <Text dimColor>{' · 백그라운드'}</Text>}
          {elapsed !== undefined && <Text dimColor>{` · ${formatElapsed(elapsed)}`}</Text>}
          {e.props.isErrored && <Text color="error">{` · ${status.label}`}</Text>}
          {e.props.isInterrupted && <Text color="warning">{` · ${status.label}`}</Text>}
        </Box>
        <Code source={bash.command} language="bash" />
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse', props: { tool: ['Read', 'Edit', 'Write'] } }, async ($, e, next) => {
    const row = describeFileRow(e.props.tool, e.props.input, e.props.output)

    if (row === undefined || !(await readEnabled($))) {
      return next(e)
    }

    const durations = await read($, durationsAtom)
    const { fileRow } = createFileRowView($.ui.resolve(e))

    return fileRow(row, rowStatus(e.props), durations[e.props.tool_use_id])
  })
}
