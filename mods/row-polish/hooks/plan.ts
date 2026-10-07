import { hasStyledSpans, hasUnsupportedMarkdown, parseBlocks } from './blocks'
import type { Block } from './blocks'
import { emphasizeCommands } from './emphasize'

export type MessagePlan =
  | { mode: 'engine' }
  | { mode: 'markdown'; text: string }
  | { mode: 'custom'; blocks: Block[] }

const ENGINE: MessagePlan = { mode: 'engine' }

const markdownPlan = (text: string): MessagePlan => {
  const emphasized = emphasizeCommands(text)

  return emphasized === text ? ENGINE : { mode: 'markdown', text: emphasized }
}

const customPlan = (text: string): MessagePlan => {
  const blocks = parseBlocks(text)

  return hasStyledSpans(blocks) ? { mode: 'custom', blocks } : ENGINE
}

export const planMessage = (text: string): MessagePlan =>
  hasUnsupportedMarkdown(text) ? markdownPlan(text) : customPlan(text)
