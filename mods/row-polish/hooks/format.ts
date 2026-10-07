import type { Durations } from '../types'

const REMEMBERED_DURATIONS = 200

const SPINNER_WORDS = {
  requesting: '요청 중',
  thinking: '생각 중',
  responding: '답변 작성 중',
  'tool-input': '도구 입력 작성 중',
  'tool-use': '도구 실행 중',
} as const

export type SpinnerMode = keyof typeof SPINNER_WORDS
export type RowStatus = { icon: string; color: string; label: string; isProblem: boolean }
export type BashInput = { command: string; description?: string; isBackground: boolean }

export const spinnerWord = (mode: SpinnerMode) => SPINNER_WORDS[mode]

export const localizeBackgroundHint = (hint: string) =>
  hint.replace(/^\((.+) to run in background\)$/, '($1: 백그라운드 실행)')

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (totalSeconds < 1) {
    return '1초 미만'
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`
  }

  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`
}

export const formatElapsed = (ms: number) => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }

  return ms < 10000 ? `${(ms / 1000).toFixed(1)}초` : formatDuration(ms)
}

export const rowStatus = (state: {
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
}): RowStatus => {
  if (state.isInterrupted) {
    return { icon: '⏹', color: 'warning', label: '중단됨', isProblem: true }
  }

  if (state.isRunning) {
    return { icon: '⏳', color: 'inactive', label: '실행 중', isProblem: false }
  }

  return state.isErrored
    ? { icon: '✖', color: 'error', label: '실패', isProblem: true }
    : { icon: '✔', color: 'success', label: '완료', isProblem: false }
}

export const readBashInput = (input: unknown): BashInput | undefined => {
  const { command, description, run_in_background } = (input ?? {}) as Record<string, unknown>

  if (typeof command !== 'string') {
    return undefined
  }

  return {
    command,
    description: typeof description === 'string' && description !== '' ? description : undefined,
    isBackground: run_in_background === true,
  }
}

export const withDuration = (durations: Durations, id: string, ms: number): Durations =>
  Object.fromEntries([...Object.entries(durations), [id, ms]].slice(-REMEMBERED_DURATIONS))
