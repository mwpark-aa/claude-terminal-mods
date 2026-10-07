import { parseInline } from './inline'
import type { Span } from './inline'

export type Line =
  | { type: 'blank' }
  | { type: 'rule' }
  | { type: 'heading'; level: number; spans: Span[] }
  | { type: 'bullet'; indent: number; marker: string; spans: Span[] }
  | { type: 'ordered'; indent: number; marker: string; spans: Span[] }
  | { type: 'quote'; spans: Span[] }
  | { type: 'text'; indent: number; spans: Span[] }

export type TextLine = Extract<Line, { type: 'text' }>

export type Block =
  | { kind: 'code'; language: string; source: string }
  | { kind: 'table'; text: string }
  | { kind: 'line'; line: Line }

const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^(\s*)([-*+])\s+(.*)$/
const ORDERED = /^(\s*)(\d+[.)])\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/
const CHECKBOX = /^\[([ xX])\]\s+(.*)$/

const bulletMarker = (indent: number, checkbox: RegExpExecArray | null) => {
  if (checkbox) {
    return checkbox[1] === ' ' ? '☐' : '☑'
  }

  return indent >= 2 ? '◦' : '•'
}

const bulletLine = (match: RegExpExecArray): Line => {
  const indent = match[1].length
  const checkbox = CHECKBOX.exec(match[3])

  return {
    type: 'bullet',
    indent,
    marker: bulletMarker(indent, checkbox),
    spans: parseInline(checkbox ? checkbox[2] : match[3]),
  }
}

const textLine = (line: string): Line => ({
  type: 'text',
  indent: /^\s*/.exec(line)?.[0].length ?? 0,
  spans: parseInline(line.trim()),
})

const classifyLine = (line: string): Line => {
  const heading = HEADING.exec(line)
  const bullet = BULLET.exec(line)
  const ordered = ORDERED.exec(line)
  const quote = QUOTE.exec(line)

  if (line.trim() === '') {
    return { type: 'blank' }
  }

  if (RULE.test(line)) {
    return { type: 'rule' }
  }

  if (heading) {
    return { type: 'heading', level: heading[1].length, spans: parseInline(heading[2]) }
  }

  if (bullet) {
    return bulletLine(bullet)
  }

  if (ordered) {
    return { type: 'ordered', indent: ordered[1].length, marker: ordered[2], spans: parseInline(ordered[3]) }
  }

  return quote ? { type: 'quote', spans: parseInline(quote[1]) } : textLine(line)
}

const isTableLine = (line: string) => line.trim().startsWith('|')

const readFence = (lines: string[], start: number): [Block[], number] => {
  const [, marker = '```', language = ''] = FENCE.exec(lines[start]) ?? []
  const closing = lines.findIndex((line, index) => index > start && line.trim().startsWith(marker))
  const end = closing === -1 ? lines.length : closing
  const source = lines.slice(start + 1, end).join('\n')

  return [source === '' ? [] : [{ kind: 'code', language, source }], Math.min(end + 1, lines.length)]
}

const readTable = (lines: string[], start: number): [Block[], number] => {
  const stop = lines.findIndex((line, index) => index > start && !isTableLine(line))
  const end = stop === -1 ? lines.length : stop

  return [[{ kind: 'table', text: lines.slice(start, end).join('\n') }], end]
}

const readBlocks = (lines: string[]): Block[] => {
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const [read, next]: [Block[], number] = FENCE.test(line)
      ? readFence(lines, index)
      : isTableLine(line)
        ? readTable(lines, index)
        : [[{ kind: 'line', line: classifyLine(line) }], index + 1]

    blocks.push(...read)
    index = next
  }

  return blocks
}

const asTextLine = (block: Block | undefined): TextLine | undefined =>
  block?.kind === 'line' && block.line.type === 'text' ? block.line : undefined

const joinParagraph = (previous: TextLine, next: TextLine): Block => ({
  kind: 'line',
  line: { type: 'text', indent: previous.indent, spans: [...previous.spans, { text: ' ' }, ...next.spans] },
})

const mergeParagraphs = (blocks: Block[]): Block[] =>
  blocks.reduce<Block[]>((merged, block) => {
    const previous = asTextLine(merged[merged.length - 1])
    const current = asTextLine(block)
    const isSameParagraph = previous !== undefined && current !== undefined && previous.indent === current.indent

    return isSameParagraph ? [...merged.slice(0, -1), joinParagraph(previous, current)] : [...merged, block]
  }, [])

export const parseBlocks = (text: string): Block[] => mergeParagraphs(readBlocks(text.split('\n')))

const withoutCode = (text: string) =>
  text.replace(/(```|~~~)[\s\S]*?(?:\1|$)/g, '').replace(/`[^`\n]*`/g, '')

const UNSUPPORTED_PATTERNS = [
  /!\[[^\]\n]*\]\(/,
  /<\/?[a-zA-Z][^>\n]*>/,
  /\[\^[^\]\n]+\]/,
  /\]\[/,
  /^[^\n|]+\n(?:=+|-+)\s*$/m,
  /\n\s*\n {4,}[^\s\-*+\d>]/,
]

export const hasUnsupportedMarkdown = (text: string) => {
  const visible = withoutCode(text)

  return UNSUPPORTED_PATTERNS.some(pattern => pattern.test(visible))
}

const spansOf = (block: Block): Span[] => {
  if (block.kind !== 'line' || block.line.type === 'blank' || block.line.type === 'rule') {
    return []
  }

  return block.line.spans
}

export const allSpans = (blocks: Block[]) => blocks.flatMap(spansOf)

export const hasStyledSpans = (blocks: Block[]) =>
  allSpans(blocks).some(span => span.kind === 'command')
