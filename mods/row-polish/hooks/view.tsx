import type { EngineInterface } from 'claude-code'

import type { Block, Line } from './blocks'
import { emphasizeCommands } from './emphasize'
import type { Span } from './inline'
import { LINK_COLOR, SPAN_STYLES } from './palette'

type Kit = ReturnType<EngineInterface['ui']['resolve']>

const RULE_WIDTH = 32

const colorStyle = (span: Span) => {
  if (span.kind === 'link') {
    return { color: LINK_COLOR, underline: true }
  }

  return span.kind === undefined ? {} : SPAN_STYLES[span.kind]
}

const styleOf = (span: Span) => ({
  ...colorStyle(span),
  ...(span.bold ? { bold: true } : {}),
  ...(span.italic ? { italic: true } : {}),
  ...(span.strike ? { strikethrough: true } : {}),
})

export const createMessageView = ({ Box, Text, Code, Link, Markdown }: Kit) => {
  const spanView = (span: Span) => {
    const style = styleOf(span)

    if (Object.keys(style).length === 0) {
      return span.text
    }

    if (span.kind === 'link' && span.href !== undefined) {
      return (
        <Text {...style}>
          <Link href={span.href}>{span.text}</Link>
        </Text>
      )
    }

    return <Text {...style}>{span.ticks ? `${span.ticks}${span.text}${span.ticks}` : span.text}</Text>
  }

  const inlineView = (spans: Span[], extra: object = {}) => (
    <Text {...extra}>{spans.map(spanView)}</Text>
  )

  const listItemView = (indent: number, marker: string, spans: Span[]) => (
    <Box marginLeft={indent}>
      <Box flexShrink={0}>
        <Text dimColor>{`${marker} `}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        {inlineView(spans)}
      </Box>
    </Box>
  )

  const quoteView = (spans: Span[]) => (
    <Box>
      <Box flexShrink={0}>
        <Text dimColor>{'▎ '}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        {inlineView(spans, { dimColor: true })}
      </Box>
    </Box>
  )

  const lineView = (line: Line) => {
    switch (line.type) {
      case 'blank':
        return <Text> </Text>
      case 'rule':
        return <Text dimColor>{'─'.repeat(RULE_WIDTH)}</Text>
      case 'heading':
        return (
          <Text bold underline={line.level === 1}>
            {line.spans.map(spanView)}
          </Text>
        )
      case 'bullet':
        return listItemView(line.indent, line.marker, line.spans)
      case 'ordered':
        return listItemView(line.indent, line.marker, line.spans)
      case 'quote':
        return quoteView(line.spans)
      default:
        return <Box marginLeft={line.indent >= 2 ? line.indent : 0}>{inlineView(line.spans)}</Box>
    }
  }

  const codeView = (language: string, source: string) =>
    language === '' ? <Code source={source} /> : <Code source={source} language={language} />

  const blockView = (block: Block) => {
    switch (block.kind) {
      case 'code':
        return codeView(block.language, block.source)
      case 'table':
        return <Markdown text={emphasizeCommands(block.text)} />
      default:
        return lineView(block.line)
    }
  }

  const frame = (isFirstOfReply: boolean, body: unknown) => (
    <Box>
      <Box flexShrink={0} width={2}>
        <Text>{isFirstOfReply ? '⏺' : ' '}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} flexDirection="column">
        {body}
      </Box>
    </Box>
  )

  const customMessage = (blocks: Block[], isFirstOfReply: boolean) =>
    frame(isFirstOfReply, <Box flexDirection="column">{blocks.map(blockView)}</Box>)

  const markdownMessage = (text: string, isFirstOfReply: boolean) =>
    frame(isFirstOfReply, <Markdown text={text} />)

  return { customMessage, markdownMessage }
}
