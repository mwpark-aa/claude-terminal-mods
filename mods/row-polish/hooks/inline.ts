import { TOKEN_ALTERNATION } from './emphasize'
import { isShellCommand } from './shell'

export type SpanKind = 'command' | 'code' | 'link'

export type Span = {
  text: string
  kind?: SpanKind
  ticks?: string
  href?: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
}

type Style = Pick<Span, 'bold' | 'italic' | 'strike'>
type Piece = { lead: string; spans: Span[] }

const WHOLE_COMMAND = new RegExp(`^(?:${TOKEN_ALTERNATION})$`)

const INLINE_PATTERN = new RegExp(
  [
    '(``?)([^`\\n]+?)\\1',
    '\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)',
    '\\*\\*(.+?)\\*\\*',
    '~~(.+?)~~',
    '(https?:\\/\\/[^\\s)]+)',
    `(^|[\\s("'])(${TOKEN_ALTERNATION})(?![\\w/-])`,
    '(^|[\\s("\'])\\*([^*\\s](?:[^*\\n]*[^*\\s])?)\\*(?![\\w*])',
  ].join('|'),
  'gm',
)

export const codeKind = (content: string): 'command' | 'code' =>
  WHOLE_COMMAND.test(content) || isShellCommand(content) ? 'command' : 'code'

const plain = (text: string, style: Style): Span[] => (text === '' ? [] : [{ text, ...style }])

const endOf = (match: RegExpMatchArray) => (match.index ?? 0) + match[0].length

const pieceOf = (match: RegExpMatchArray, style: Style): Piece => {
  const [, ticks, code, label, href, bold, strike, url, tokenPrefix, token, italicPrefix, italic] = match

  if (code !== undefined) {
    return { lead: '', spans: [{ text: code, kind: codeKind(code), ticks, ...style }] }
  }

  if (label !== undefined) {
    return { lead: '', spans: [{ text: label, kind: 'link', href, ...style }] }
  }

  if (bold !== undefined) {
    return { lead: '', spans: parseInline(bold, { ...style, bold: true }) }
  }

  if (strike !== undefined) {
    return { lead: '', spans: parseInline(strike, { ...style, strike: true }) }
  }

  if (url !== undefined) {
    return { lead: '', spans: [{ text: url, kind: 'link', href: url, ...style }] }
  }

  if (token !== undefined) {
    return { lead: tokenPrefix, spans: [{ text: token, kind: 'command', ...style }] }
  }

  return { lead: italicPrefix, spans: parseInline(italic, { ...style, italic: true }) }
}

const spansBefore = (text: string, matches: RegExpMatchArray[], style: Style) =>
  matches.flatMap((match, index) => {
    const previousEnd = index === 0 ? 0 : endOf(matches[index - 1])
    const piece = pieceOf(match, style)

    return [...plain(text.slice(previousEnd, match.index) + piece.lead, style), ...piece.spans]
  })

export const parseInline = (text: string, style: Style = {}): Span[] => {
  const matches = [...text.matchAll(INLINE_PATTERN)]
  const tailStart = matches.length === 0 ? 0 : endOf(matches[matches.length - 1])

  return [...spansBefore(text, matches, style), ...plain(text.slice(tailStart), style)]
}
