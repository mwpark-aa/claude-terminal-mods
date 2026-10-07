export type FileAction = 'read' | 'edit' | 'write'

export type FileRow = {
  label: string
  action: FileAction
  directory: string
  name: string
  detail?: string
  added?: number
  removed?: number
}

type Change = Pick<FileRow, 'detail' | 'added' | 'removed'>

const HOME_PATTERN = /^\/(?:Users|home)\/[^/]+/
const DELETE_COMMAND = /(?:^|[\s;&|(])(?:sudo\s+)?(?:rm|rmdir|unlink|trash)\s|\bgit\s+rm\b|\bfind\b.*\s-delete\b/

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const countLines = (text: string) => (text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0))

export const isDeleteCommand = (command: string) => DELETE_COMMAND.test(command)

export const splitFilePath = (path: string) => {
  const shortened = path.replace(HOME_PATTERN, '~')
  const cut = shortened.lastIndexOf('/') + 1

  return { directory: shortened.slice(0, cut), name: shortened.slice(cut) }
}

const requestedRange = (input: Record<string, unknown>) => {
  if (input.offset === undefined && input.limit === undefined) {
    return undefined
  }

  return `${input.offset ?? 1}줄부터${input.limit === undefined ? '' : ` ${input.limit}줄`}`
}

const textReadDetail = (file: Record<string, unknown>) => {
  const numLines = Number(file.numLines)
  const startLine = Number(file.startLine)
  const totalLines = Number(file.totalLines)

  if (!Number.isFinite(numLines) || !Number.isFinite(startLine) || !Number.isFinite(totalLines)) {
    return undefined
  }

  const isPartial = startLine > 1 || numLines < totalLines

  return isPartial ? `${startLine}–${startLine + numLines - 1}줄 / 총 ${totalLines}줄` : `${numLines}줄`
}

const READ_KINDS: Record<string, string> = {
  image: '이미지',
  pdf: 'PDF',
  parts: 'PDF',
  notebook: '노트북',
  file_unchanged: '이미 읽은 파일',
}

const readDetail = (input: unknown, output: unknown) => {
  const result = asRecord(output)

  if (result.type === 'text') {
    return textReadDetail(asRecord(result.file))
  }

  return typeof result.type === 'string' ? READ_KINDS[result.type] : requestedRange(asRecord(input))
}

const patchLines = (output: Record<string, unknown>): string[] => {
  const hunks = Array.isArray(output.structuredPatch) ? output.structuredPatch : []

  return hunks.flatMap(hunk => (Array.isArray(asRecord(hunk).lines) ? (asRecord(hunk).lines as string[]) : []))
}

const countLinesStartingWith = (lines: string[], marker: string) =>
  lines.filter(line => line.startsWith(marker)).length

const editChange = (input: unknown, output: unknown): Change => {
  const result = asRecord(output)
  const lines = patchLines(result)
  const isReplaceAll = asRecord(input).replace_all === true

  if (result.staged === true) {
    return { detail: '검토 대기' }
  }

  return {
    detail: replaceAllDetail(isReplaceAll),
    added: lines.length === 0 ? undefined : countLinesStartingWith(lines, '+'),
    removed: lines.length === 0 ? undefined : countLinesStartingWith(lines, '-'),
  }
}

const replaceAllDetail = (isReplaceAll: boolean) => (isReplaceAll ? '전체 바꾸기' : undefined)

const WRITE_KINDS: Record<string, string> = { create: '새 파일', update: '덮어씀' }

const writeDetail = (output: unknown) => {
  const result = asRecord(output)
  const kind = typeof result.type === 'string' ? WRITE_KINDS[result.type] : undefined
  const lines = typeof result.content === 'string' ? `${countLines(result.content)}줄` : undefined

  return [kind, lines].filter(part => part !== undefined).join(' · ') || undefined
}

export const describeFileRow = (tool: string, input: unknown, output: unknown): FileRow | undefined => {
  const filePath = asRecord(input).file_path

  if (typeof filePath !== 'string') {
    return undefined
  }

  const location = splitFilePath(filePath)

  switch (tool) {
    case 'Read':
      return { label: 'Read', action: 'read', ...location, detail: readDetail(input, output) }
    case 'Edit':
      return { label: 'Edit', action: 'edit', ...location, ...editChange(input, output) }
    case 'Write':
      return { label: 'Write', action: 'write', ...location, detail: writeDetail(output) }
    default:
      return undefined
  }
}
