export type SpanStyle = { color: string; bold?: true }

export const SPAN_STYLES: Record<'command' | 'code', SpanStyle> = {
  command: { color: '#7dd3fc', bold: true },
  code: { color: '#cbd5e1' },
}

export const LINK_COLOR = '#93c5fd'

export const ACTION_COLORS = {
  read: '#94a3b8',
  edit: '#c4b5fd',
  write: '#67e8f9',
  delete: '#f9a8d4',
} as const
