const PROTECTED_PATTERN = new RegExp(
  [
    '```[\\s\\S]*?(?:```|$)',
    '~~~[\\s\\S]*?(?:~~~|$)',
    '``[^`]+``',
    '`[^`\\n]*`',
    '\\[[^\\]\\n]*\\]\\([^)\\n]*\\)',
    'https?:\\/\\/[^\\s)]+',
    '<[^>\\n]+>',
  ].join('|'),
)

const SPLITTING_PATTERN = new RegExp(`(${PROTECTED_PATTERN.source})`)

const CLAUDE_SUBCOMMANDS =
  'update|plugin|mcp|doctor|config|auth|install|login|logout|agents|migrate-installer|setup-token'

const COMMAND_TOKENS = [
  String.raw`claude (?:--?[\w-]+|${CLAUDE_SUBCOMMANDS})(?: (?:--?[\w-]+|[\w./~:@=-]+))*`,
  String.raw`\/[a-z][\w-]*(?::[\w-]+)?`,
]

export const TOKEN_ALTERNATION = COMMAND_TOKENS.join('|')

const TOKEN_PATTERN = new RegExp(`(^|[\\s("'])(${TOKEN_ALTERNATION})(?![\\w/-])`, 'gm')

const asInlineCode = (_match: string, prefix: string, token: string) => `${prefix}\`${token}\``

const wrapTokens = (text: string) => text.replace(TOKEN_PATTERN, asInlineCode)

const isProtectedPart = (index: number) => index % 2 === 1

export const emphasizeCommands = (markdown: string) =>
  markdown
    .split(SPLITTING_PATTERN)
    .map((part, index) => (isProtectedPart(index) ? part : wrapTokens(part)))
    .join('')
