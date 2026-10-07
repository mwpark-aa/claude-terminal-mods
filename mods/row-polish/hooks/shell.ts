const EXECUTABLES = [
  'ls', 'cd', 'git', 'npm', 'npx', 'pnpm', 'yarn', 'node', 'tsc', 'docker', 'docker-compose', 'kubectl',
  'python', 'python3', 'pip', 'pip3', 'uv', 'pytest', 'java', 'gradle', 'mvn', 'make',
  'curl', 'cat', 'grep', 'rg', 'find', 'sed', 'awk', 'tail', 'head', 'chmod', 'mkdir', 'rm', 'cp', 'mv', 'ln',
  'brew', 'ssh', 'scp', 'echo', 'export', 'source', 'bash', 'sh', 'touch', 'diff', 'wc', 'sort', 'xargs', 'jq',
  'tar', 'unzip', 'which', 'open', 'pbcopy', 'kill', 'ps', 'du', 'df', 'env',
  'hive', 'beeline', 'spark-submit', 'airflow',
]

const SHELL_COMMAND = new RegExp(`^(?:sudo\\s+)?(?:\\.{1,2}\\/[\\w./-]+|(?:${EXECUTABLES.join('|')}))\\s+\\S.*$`)

export const isShellCommand = (content: string) => SHELL_COMMAND.test(content)
