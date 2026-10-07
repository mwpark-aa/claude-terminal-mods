import { expect, test } from 'claude-code/testing'

import { isShellCommand } from './shell'

test('알려진 실행 파일에 인자가 붙으면 셸 명령으로 본다', () => {
  expect(isShellCommand('ls -la')).toBe(true)
  expect(isShellCommand('git status')).toBe(true)
  expect(isShellCommand('npm run build')).toBe(true)
  expect(isShellCommand('./gradlew test')).toBe(true)
  expect(isShellCommand('sudo rm -rf /tmp/x')).toBe(true)
})

test('이름만 있거나 알려지지 않은 단어는 셸 명령으로 보지 않는다', () => {
  expect(isShellCommand('ls')).toBe(false)
  expect(isShellCommand('docker')).toBe(false)
  expect(isShellCommand('foo bar')).toBe(false)
  expect(isShellCommand('복사: /compact')).toBe(false)
  expect(isShellCommand('lsof -i')).toBe(false)
})
