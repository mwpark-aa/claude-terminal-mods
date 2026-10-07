import { expect, test } from 'claude-code/testing'

import { describeFileRow, isDeleteCommand, splitFilePath } from './files'

const READ_OUTPUT = (numLines: number, startLine: number, totalLines: number) => ({
  type: 'text',
  file: { filePath: '/x', content: '', numLines, startLine, totalLines },
})

test('홈 폴더는 ~로 줄이고 폴더와 이름을 나눈다', () => {
  expect(splitFilePath('/Users/bagmin-u/.claude/mods/view.tsx')).toEqual({
    directory: '~/.claude/mods/',
    name: 'view.tsx',
  })
  expect(splitFilePath('/etc/hosts')).toEqual({ directory: '/etc/', name: 'hosts' })
})

test('Read는 전체를 읽으면 줄 수만, 일부만 읽으면 범위와 전체 줄 수를 보여준다', () => {
  const input = { file_path: '/Users/bagmin-u/a.ts' }

  expect(describeFileRow('Read', input, READ_OUTPUT(120, 1, 120))?.detail).toBe('120줄')
  expect(describeFileRow('Read', input, READ_OUTPUT(50, 41, 220))?.detail).toBe('41–90줄 / 총 220줄')
})

test('Read는 결과가 아직 없으면 요청한 범위를 보여준다', () => {
  expect(describeFileRow('Read', { file_path: '/a', offset: 10, limit: 20 }, undefined)?.detail).toBe('10줄부터 20줄')
  expect(describeFileRow('Read', { file_path: '/a' }, undefined)?.detail).toBeUndefined()
})

test('Read는 이미지, PDF, 노트북, 이미 읽은 파일을 구분한다', () => {
  expect(describeFileRow('Read', { file_path: '/a.png' }, { type: 'image', file: {} })?.detail).toBe('이미지')
  expect(describeFileRow('Read', { file_path: '/a.pdf' }, { type: 'pdf', file: {} })?.detail).toBe('PDF')
  expect(describeFileRow('Read', { file_path: '/a.ipynb' }, { type: 'notebook', file: {} })?.detail).toBe('노트북')
  expect(describeFileRow('Read', { file_path: '/a' }, { type: 'file_unchanged', file: {} })?.detail).toBe('이미 읽은 파일')
})

test('Edit는 늘어난 줄과 줄어든 줄 수를 센다', () => {
  const output = { structuredPatch: [{ lines: [' 같음', '-지움', '-지움2', '+추가', '+추가2', '+추가3'] }] }
  const row = describeFileRow('Edit', { file_path: '/a/palette.ts' }, output)

  expect(row).toMatchObject({ label: 'Edit', action: 'edit', name: 'palette.ts', added: 3, removed: 2 })
})

test('Edit는 결과가 없으면 증감을 보여주지 않고, 전체 바꾸기와 검토 대기를 표시한다', () => {
  expect(describeFileRow('Edit', { file_path: '/a' }, undefined)).toMatchObject({ added: undefined, removed: undefined })
  expect(describeFileRow('Edit', { file_path: '/a', replace_all: true }, undefined)?.detail).toBe('전체 바꾸기')
  expect(describeFileRow('Edit', { file_path: '/a' }, { staged: true, structuredPatch: [] })?.detail).toBe('검토 대기')
})

test('Write는 새 파일인지 덮어쓴 건지와 줄 수를 보여준다', () => {
  expect(describeFileRow('Write', { file_path: '/a' }, { type: 'create', content: 'a\nb\nc\n' })?.detail).toBe('새 파일 · 3줄')
  expect(describeFileRow('Write', { file_path: '/a' }, { type: 'update', content: 'a\nb' })?.detail).toBe('덮어씀 · 2줄')
  expect(describeFileRow('Write', { file_path: '/a' }, undefined)?.detail).toBeUndefined()
})

test('파일 경로가 없거나 다른 도구면 만들지 않는다', () => {
  expect(describeFileRow('Read', {}, undefined)).toBeUndefined()
  expect(describeFileRow('WebFetch', { file_path: '/a' }, undefined)).toBeUndefined()
})

test('삭제 명령을 알아본다', () => {
  expect(isDeleteCommand('rm -rf /tmp/old')).toBe(true)
  expect(isDeleteCommand('sudo rm file')).toBe(true)
  expect(isDeleteCommand('git rm --cached a')).toBe(true)
  expect(isDeleteCommand('find . -name "*.tmp" -delete')).toBe(true)
  expect(isDeleteCommand('cd x && rmdir y')).toBe(true)
})

test('삭제와 비슷해 보이지만 아닌 명령은 삭제로 보지 않는다', () => {
  expect(isDeleteCommand('ls -la')).toBe(false)
  expect(isDeleteCommand('echo format')).toBe(false)
  expect(isDeleteCommand('grep -rn "rm" src')).toBe(false)
  expect(isDeleteCommand('git status')).toBe(false)
})
