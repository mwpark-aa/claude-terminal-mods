import { expect, test } from 'claude-code/testing'

import type { Snapshot } from '../types'
import {
  bandRows,
  cellWidth,
  compactAdvice,
  folderName,
  formatRemaining,
  gaugeCells,
  gradientColor,
  percentText,
  rememberSkill,
  rowText,
} from './format'

const MINUTE_MS = 60 * 1000
const NOW_MS = 12 * MINUTE_MS
const WIDE = 200

const resetsIn = (minutes: number) => new Date(NOW_MS + minutes * MINUTE_MS).toISOString()

const snapshotAt = (contextPercent: number, withLimits = true): Snapshot => ({
  model: 'claude-sonnet-5-5',
  folder: 'sup-airflow',
  contextPercent,
  capturedAt: NOW_MS,
  limits: withLimits
    ? [
        { kind: 'five_hour', percentUsed: 23.5, resetsAt: resetsIn(2 * 60 + 14) },
        { kind: 'seven_day', percentUsed: 61, resetsAt: resetsIn(3 * 1440 + 2 * 60) },
      ]
    : [],
})

test('여유로우면 초록, 중간은 노랑, 거의 다 쓰면 빨강이다', () => {
  expect(gradientColor(0)).toBe('#4ade80')
  expect(gradientColor(50)).toBe('#facc15')
  expect(gradientColor(100)).toBe('#ef4444')
})

test('색은 사용률이 오를수록 서서히 바뀌어 단계마다 다르다', () => {
  const colors = [0, 25, 50, 75, 100].map(gradientColor)

  expect(new Set(colors).size).toBe(colors.length)
})

test('게이지는 칸마다 위치에 맞는 색을 갖고 빈 칸은 색이 없다', () => {
  const cells = gaugeCells(25)

  expect(cells.filter(cell => cell.color !== undefined)).toHaveLength(2)
  expect(cells[2]).toEqual({ glyph: '░' })
  expect(cells[0].color).toBe(gradientColor(12.5))
})

test('0보다 크면 최소 한 칸은 채운다', () => {
  expect(gaugeCells(1).filter(cell => cell.color !== undefined)).toHaveLength(1)
  expect(gaugeCells(0).filter(cell => cell.color !== undefined)).toHaveLength(0)
})

test('사용률에 따라 /compact 안내 문구가 바뀐다', () => {
  expect(compactAdvice(69)).toBeUndefined()
  expect(compactAdvice(70)).toBe('곧 /compact 권장')
  expect(compactAdvice(85)).toBe('/compact 하세요')
})

test('초기화까지 남은 시간을 일, 시간, 분으로 보여준다', () => {
  expect(formatRemaining(35 * MINUTE_MS)).toBe('35분')
  expect(formatRemaining((2 * 60 + 14) * MINUTE_MS)).toBe('2시간 14분')
  expect(formatRemaining((3 * 1440 + 2 * 60) * MINUTE_MS)).toBe('3일 2시간')
})

test('한글과 이모지는 두 칸으로 센다', () => {
  expect(cellWidth('abc')).toBe(3)
  expect(cellWidth('대화')).toBe(4)
  expect(cellWidth('📁')).toBe(2)
})

test('퍼센트는 자릿수가 달라도 같은 폭으로 맞춘다', () => {
  expect(percentText(7)).toBe('  7%')
  expect(percentText(19)).toBe(' 19%')
  expect(percentText(100)).toBe('100%')
})

test('경로에서 폴더 이름만 뽑는다', () => {
  expect(folderName('/Users/bagmin-u/work/sup-airflow')).toBe('sup-airflow')
  expect(folderName('/Users/bagmin-u/work/sup-airflow/')).toBe('sup-airflow')
})

test('쓴 스킬은 중복 없이 최근 것이 뒤로 간다', () => {
  expect(rememberSkill(['a', 'b'], 'a')).toEqual(['b', 'a'])
})

test('첫 줄에 모델과 폴더를, 이어서 대화 용량과 두 한도를 한 줄씩 보여준다', () => {
  expect(bandRows(snapshotAt(75), [], WIDE).map(rowText)).toEqual([
    'sonnet-5-5 │ 📁 sup-airflow',
    '대화 용량 ░░░░░░░░  75% · 곧 /compact 권장',
    '5시간     ░░░░░░░░  24% · 2시간 14분 후 초기화',
    '주간      ░░░░░░░░  61% · 3일 2시간 후 초기화',
  ])
})

test('세 게이지는 시작 위치가 같다', () => {
  const [, ...gauges] = bandRows(snapshotAt(40), [], WIDE).map(rowText)
  const starts = gauges.map(text => cellWidth(text.slice(0, text.indexOf('░'))))

  expect(new Set(starts).size).toBe(1)
})

test('쓴 스킬은 최근 두 개만 보여주고 나머지는 개수로 줄인다', () => {
  const [header] = bandRows(snapshotAt(10, false), ['x:one', 'two', 'three'], WIDE).map(rowText)

  expect(header).toBe('sonnet-5-5 │ 📁 sup-airflow │ ✦ two, three +1')
})

test('스킬 이름에서 앞의 네임스페이스는 뗀다', () => {
  const [header] = bandRows(snapshotAt(10, false), ['superpowers:brainstorming'], WIDE).map(rowText)

  expect(header).toBe('sonnet-5-5 │ 📁 sup-airflow │ ✦ brainstorming')
})

test('폭이 좁으면 첫 줄에서 뒤쪽 항목부터 뺀다', () => {
  const [header] = bandRows(snapshotAt(10, false), ['brainstorming'], 25).map(rowText)

  expect(header).toBe('sonnet-5-5')
})

test('한도 정보가 없으면 대화 용량 줄만 이어진다', () => {
  expect(bandRows(snapshotAt(10, false), [], WIDE).map(rowText)).toEqual([
    'sonnet-5-5 │ 📁 sup-airflow',
    '대화 용량 ░░░░░░░░  10%',
  ])
})

test('거의 다 차면 경고 표시를 붙인다', () => {
  expect(rowText(bandRows(snapshotAt(90, false), [], WIDE)[1])).toBe(
    '⚠ 대화 용량 ░░░░░░░░  90% · /compact 하세요',
  )
})
