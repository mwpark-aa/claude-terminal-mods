export type Durations = Record<string, number>

declare module 'claude-code' {
  interface PluginState {
    'row-polish': { durations: Durations }
  }
}
