import { expect, test } from 'claude-code/testing'

import {
  formatDuration,
  formatElapsed,
  localizeBackgroundHint,
  readBashInput,
  rowStatus,
  spinnerWord,
  withDuration,
} from './format'

test('스피너 상태를 한글 문구로 바꾼다', () => {
  expect(spinnerWord('thinking')).toBe('생각 중')
  expect(spinnerWord('tool-use')).toBe('도구 실행 중')
  expect(spinnerWord('responding')).toBe('답변 작성 중')
})

test('백그라운드 안내를 한글로 바꾸고 단축키 표기는 그대로 둔다', () => {
  expect(localizeBackgroundHint('(ctrl+b to run in background)')).toBe('(ctrl+b: 백그라운드 실행)')
  expect(localizeBackgroundHint('(ctrl+x b to run in background)')).toBe('(ctrl+x b: 백그라운드 실행)')
})

test('알 수 없는 형식의 안내는 그대로 둔다', () => {
  expect(localizeBackgroundHint('something else')).toBe('something else')
})

test('소요 시간을 한글로 보여준다', () => {
  expect(formatDuration(400)).toBe('1초 미만')
  expect(formatDuration(3000)).toBe('3초')
  expect(formatDuration(64000)).toBe('1분 4초')
  expect(formatDuration(3720000)).toBe('1시간 2분')
})

test('도구 소요 시간은 짧으면 ms, 10초 미만은 소수점 한 자리로 보여준다', () => {
  expect(formatElapsed(420)).toBe('420ms')
  expect(formatElapsed(2300)).toBe('2.3초')
  expect(formatElapsed(64000)).toBe('1분 4초')
})

test('도구 줄 상태는 중단, 실행 중, 실패, 완료 순으로 판단한다', () => {
  const base = { isRunning: false, isErrored: false, isInterrupted: false }

  expect(rowStatus({ ...base, isInterrupted: true, isRunning: true }).icon).toBe('⏹')
  expect(rowStatus({ ...base, isRunning: true }).icon).toBe('⏳')
  expect(rowStatus({ ...base, isErrored: true })).toEqual({ icon: '✖', color: 'error', label: '실패', isProblem: true })
  expect(rowStatus(base)).toEqual({ icon: '✔', color: 'success', label: '완료', isProblem: false })
})

test('Bash 입력에서 명령어와 설명, 백그라운드 여부를 읽는다', () => {
  expect(readBashInput({ command: 'ls -la', description: '파일 목록 보기', run_in_background: true })).toEqual({
    command: 'ls -la',
    description: '파일 목록 보기',
    isBackground: true,
  })
  expect(readBashInput({ command: 'ls', description: '' })).toEqual({
    command: 'ls',
    description: undefined,
    isBackground: false,
  })
})

test('명령어가 없는 입력은 읽지 않는다', () => {
  expect(readBashInput(undefined)).toBeUndefined()
  expect(readBashInput({ description: 'x' })).toBeUndefined()
})

test('소요 시간은 최근 200개만 기억한다', () => {
  const filled = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`id${index}`, index]))
  const next = withDuration(filled, 'new', 5)

  expect(Object.keys(next)).toHaveLength(200)
  expect(next.id0).toBeUndefined()
  expect(next.new).toBe(5)
})
