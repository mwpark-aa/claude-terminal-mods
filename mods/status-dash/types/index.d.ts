export type LimitUsage = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  model: string
  folder: string
  contextPercent: number
  limits: readonly LimitUsage[]
  capturedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'status-dash': { snapshot: Snapshot | null; skills: string[] }
  }
}
