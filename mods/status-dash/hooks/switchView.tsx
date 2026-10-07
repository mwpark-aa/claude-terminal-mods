import type { EngineInterface } from 'claude-code'

import { stateText } from './switch'

type Kit = ReturnType<EngineInterface['ui']['resolve']>
type Choose = (isEnabled: boolean) => void

export const createSwitchView = ({ Box, Text, Button }: Kit) => {
  const switchView = (name: string, isEnabled: boolean, choose: Choose) => (
    <Box flexDirection="column" rowGap={1}>
      <Text bold>{stateText(name, isEnabled)}</Text>
      <Box columnGap={3}>
        <Button key="on" label="켜기" hotkey="1" plain onPress={() => choose(true)} />
        <Button key="off" label="끄기" hotkey="2" plain onPress={() => choose(false)} />
      </Box>
      <Text dimColor>숫자 키나 클릭으로 고르고, Esc로 닫아요</Text>
    </Box>
  )

  return { switchView }
}
