export type SwitchAction = 'on' | 'off' | 'status' | 'ask' | 'invalid'

export const ENABLED_KEY = 'enabled'
export const CHANGE_TOAST_MS = 2000
const ON_WORDS = ['on', '켜기', '켜', 'enable']
const OFF_WORDS = ['off', '끄기', '꺼', 'disable']
const STATUS_WORDS = ['status', '상태']

export const switchPaneId = (name: string) => `${name}-switch`

export const parseSwitchArgs = (args: string): SwitchAction => {
  const word = args.trim().toLowerCase()

  if (word === '') {
    return 'ask'
  }

  if (ON_WORDS.includes(word)) {
    return 'on'
  }

  if (OFF_WORDS.includes(word)) {
    return 'off'
  }

  return STATUS_WORDS.includes(word) ? 'status' : 'invalid'
}

const stateWord = (isEnabled: boolean) => (isEnabled ? '켜져' : '꺼져')

export const stateText = (name: string, isEnabled: boolean) => `${name} 은(는) 지금 ${stateWord(isEnabled)} 있어요.`

export const changedText = (name: string, isEnabled: boolean) => `${name} 을(를) ${isEnabled ? '켰어요' : '껐어요'}.`

export const usageText = (name: string) => `사용법: /${name} [on|off|status] (인자 없이 입력하면 고를 수 있어요)`
