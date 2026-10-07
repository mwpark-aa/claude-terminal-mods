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
import { createMessageView } from './view'

const durationsAtom = atom({ plugin: 'row-polish', key: 'durations' } as const, {})

const recordDuration = ($: EngineInterface, id: string, ms: number) =>
  update($, durationsAtom, durations => withDuration(durations, id, ms))

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode) } }),
  )

  on('ui.render', { component: 'ToolProgress' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, hint: localizeBackgroundHint(e.props.hint) } }),
  )

  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color="success">✔</Text>
        <Text dimColor>{` ${formatDuration(e.props.durationMs)} 만에 완료`}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const plan = planMessage(e.props.text)

    if (e.props.isSummary || plan.mode === 'engine') {
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

    if (bash === undefined) {
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

    if (row === undefined) {
      return next(e)
    }

    const durations = await read($, durationsAtom)
    const { fileRow } = createFileRowView($.ui.resolve(e))

    return fileRow(row, rowStatus(e.props), durations[e.props.tool_use_id])
  })
}
