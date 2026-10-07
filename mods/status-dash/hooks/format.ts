import type { LimitUsage, Snapshot } from '../types'

export const METER_WIDTH = 8
export const COMPACT_ADVISE_PERCENT = 70
export const COMPACT_URGENT_PERCENT = 85
export const SEPARATOR = ' │ '

const FILLED_GLYPH = '▓'
const EMPTY_GLYPH = '░'
const SHOWN_SKILLS = 2
const REMEMBERED_SKILLS = 20
const LIMIT_KINDS = [
  { kind: 'five_hour', label: '5시간' },
  { kind: 'seven_day', label: '주간' },
] as const

type Rgb = readonly [number, number, number]

const GREEN: Rgb = [74, 222, 128]
const YELLOW: Rgb = [250, 204, 21]
const RED: Rgb = [239, 68, 68]

export type GaugeSegment = { label: string; percent: number; note?: string }
export type BandRow = { parts: string[]; segments: GaugeSegment[] }
export type GaugeCell = { glyph: string; color?: string }

export const clampPercent = (percent: number) => Math.min(100, Math.max(0, Math.round(percent)))

const blend = (from: Rgb, to: Rgb, ratio: number): Rgb => [
  Math.round(from[0] + (to[0] - from[0]) * ratio),
  Math.round(from[1] + (to[1] - from[1]) * ratio),
  Math.round(from[2] + (to[2] - from[2]) * ratio),
]

const toHex = (rgb: Rgb) => `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`

export const gradientColor = (percent: number) => {
  const ratio = clampPercent(percent) / 100

  return ratio < 0.5
    ? toHex(blend(GREEN, YELLOW, ratio * 2))
    : toHex(blend(YELLOW, RED, (ratio - 0.5) * 2))
}

const filledCount = (percent: number) => {
  const proportional = Math.round((clampPercent(percent) / 100) * METER_WIDTH)

  return percent > 0 ? Math.max(1, proportional) : 0
}

export const gaugeCells = (percent: number): GaugeCell[] => {
  const filled = filledCount(percent)

  return Array.from({ length: METER_WIDTH }, (_, index) =>
    index < filled
      ? { glyph: FILLED_GLYPH, color: gradientColor(((index + 1) / METER_WIDTH) * 100) }
      : { glyph: EMPTY_GLYPH },
  )
}

export const compactAdvice = (percent: number) => {
  if (percent >= COMPACT_URGENT_PERCENT) {
    return '/compact 하세요'
  }

  return percent >= COMPACT_ADVISE_PERCENT ? '곧 /compact 권장' : undefined
}

export const formatRemaining = (ms: number) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days}일 ${hours}시간`
  }

  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`
}

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`
  }

  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`
}

export const shortModelName = (model: string) => model.replace(/^claude-/, '')

export const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

const skillName = (skill: string) => skill.split(':').at(-1) ?? skill

export const rememberSkill = (used: readonly string[], skill: string) =>
  [...used.filter(candidate => candidate !== skill), skill].slice(-REMEMBERED_SKILLS)

const skillsPart = (used: readonly string[]) => {
  if (used.length === 0) {
    return []
  }

  const shown = used.slice(-SHOWN_SKILLS).map(skillName).join(', ')
  const hidden = used.length - SHOWN_SKILLS

  return [hidden > 0 ? `✦ ${shown} +${hidden}` : `✦ ${shown}`]
}

const isWideCharacter = (codePoint: number) =>
  (codePoint >= 0x1100 && codePoint <= 0x115f) ||
  (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
  (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
  (codePoint >= 0xff00 && codePoint <= 0xff60) ||
  (codePoint >= 0x1f300 && codePoint <= 0x1faff)

export const cellWidth = (text: string) =>
  [...text].reduce((width, character) => width + (isWideCharacter(character.codePointAt(0) ?? 0) ? 2 : 1), 0)

export const percentText = (percent: number) => `${clampPercent(percent)}%`.padStart(4)

const padLabel = (label: string, width: number) => label + ' '.repeat(width - cellWidth(label))

const alignLabels = (segments: GaugeSegment[]) => {
  const width = Math.max(0, ...segments.map(segment => cellWidth(segment.label)))

  return segments.map(segment => ({ ...segment, label: padLabel(segment.label, width) }))
}

const resetNote = (limit: LimitUsage, now: number) =>
  limit.resetsAt ? `${formatRemaining(Date.parse(limit.resetsAt) - now)} 후 초기화` : undefined

const limitSegments = (snapshot: Snapshot): GaugeSegment[] =>
  LIMIT_KINDS.flatMap(({ kind, label }) => {
    const limit = snapshot.limits.find(candidate => candidate.kind === kind)

    return limit
      ? [{ label, percent: limit.percentUsed, note: resetNote(limit, snapshot.capturedAt) }]
      : []
  })

const contextSegment = (snapshot: Snapshot): GaugeSegment => {
  const isUrgent = snapshot.contextPercent >= COMPACT_URGENT_PERCENT

  return {
    label: isUrgent ? '⚠ 대화 용량' : '대화 용량',
    percent: snapshot.contextPercent,
    note: compactAdvice(snapshot.contextPercent),
  }
}

const segmentText = (segment: GaugeSegment) => {
  const gauge = `${segment.label} ${EMPTY_GLYPH.repeat(METER_WIDTH)} ${percentText(segment.percent)}`

  return segment.note ? `${gauge} · ${segment.note}` : gauge
}

export const rowText = (row: BandRow) =>
  [...row.parts, ...row.segments.map(segmentText)].join(SEPARATOR)

const fitParts = (parts: string[], columns: number): string[] => {
  const fits = cellWidth(parts.join(SEPARATOR)) <= columns

  return fits || parts.length <= 1 ? parts : fitParts(parts.slice(0, -1), columns)
}

const headerRow = (snapshot: Snapshot, used: readonly string[], columns: number): BandRow => ({
  parts: fitParts(
    [shortModelName(snapshot.model), `📁 ${snapshot.folder}`, ...skillsPart(used)],
    columns,
  ),
  segments: [],
})

export const bandRows = (snapshot: Snapshot, used: readonly string[], columns: number): BandRow[] => [
  headerRow(snapshot, used, columns),
  ...alignLabels([contextSegment(snapshot), ...limitSegments(snapshot)]).map(segment => ({
    parts: [],
    segments: [segment],
  })),
]
