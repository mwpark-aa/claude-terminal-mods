import type { EngineInterface } from 'claude-code'

import type { FileRow } from './files'
import { formatElapsed } from './format'
import type { RowStatus } from './format'
import { ACTION_COLORS } from './palette'

type Kit = ReturnType<EngineInterface['ui']['resolve']>

export const createFileRowView = ({ Box, Text }: Kit) => {
  const fileRow = (row: FileRow, status: RowStatus, elapsed: number | undefined) => (
    <Box flexDirection="column">
      <Box>
        <Text color={status.color}>{`${status.icon} `}</Text>
        <Text bold color={ACTION_COLORS[row.action]}>
          {row.label}
        </Text>
        <Text bold>{` · ${row.name}`}</Text>
        {row.detail !== undefined && <Text dimColor>{` · ${row.detail}`}</Text>}
        {row.added !== undefined && <Text color="success">{` +${row.added}`}</Text>}
        {row.removed !== undefined && <Text color="error">{` −${row.removed}`}</Text>}
        {elapsed !== undefined && <Text dimColor>{` · ${formatElapsed(elapsed)}`}</Text>}
        {status.isProblem && <Text color={status.color}>{` · ${status.label}`}</Text>}
      </Box>
      {row.directory !== '' && <Text dimColor>{`  ${row.directory}`}</Text>}
    </Box>
  )

  return { fileRow }
}
