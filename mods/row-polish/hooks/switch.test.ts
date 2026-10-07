import { expect, test } from 'claude-code/testing'

import { changedText, parseSwitchArgs, stateText, switchPaneId, usageText } from './switch'

test('인자가 없으면 고르는 창을 연다', () => {
  expect(parseSwitchArgs('')).toBe('ask')
  expect(parseSwitchArgs('   ')).toBe('ask')
})

test('켜기와 끄기, 상태 보기를 영어와 한글로 알아듣는다', () => {
  expect(parseSwitchArgs('on')).toBe('on')
  expect(parseSwitchArgs('ON')).toBe('on')
  expect(parseSwitchArgs('켜기')).toBe('on')
  expect(parseSwitchArgs('off')).toBe('off')
  expect(parseSwitchArgs(' 끄기 ')).toBe('off')
  expect(parseSwitchArgs('status')).toBe('status')
  expect(parseSwitchArgs('상태')).toBe('status')
})

test('알 수 없는 인자는 사용법을 안내한다', () => {
  expect(parseSwitchArgs('maybe')).toBe('invalid')
})

test('문구와 창 이름을 만든다', () => {
  expect(stateText('status-dash', true)).toBe('status-dash 은(는) 지금 켜져 있어요.')
  expect(stateText('status-dash', false)).toBe('status-dash 은(는) 지금 꺼져 있어요.')
  expect(changedText('status-dash', false)).toBe('status-dash 을(를) 껐어요.')
  expect(usageText('status-dash')).toContain('/status-dash [on|off|status]')
  expect(switchPaneId('status-dash')).toBe('status-dash-switch')
})
