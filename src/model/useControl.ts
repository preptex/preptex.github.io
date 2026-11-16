import { useState } from 'react';

export type InputHandlingOption = 'preserve' | 'inline';

export function isInputHandlingOption(value: string): value is InputHandlingOption {
  return value === 'preserve' || value === 'inline';
}

export interface CoreOptionsUI {
  readonly suppressComments: boolean;
  readonly suppressCommentEnvironments: boolean;
  readonly inputHandling: InputHandlingOption;
  readonly stripDeclarationsAndSetters: boolean;
  readonly outputName: string;
}

export const DEFAULT_CORE_OPTIONS: CoreOptionsUI = {
  suppressComments: false,
  suppressCommentEnvironments: false,
  inputHandling: 'preserve',
  stripDeclarationsAndSetters: true,
  outputName: '',
};

export function useControl(initial?: Partial<CoreOptionsUI>) {
  const [options, setOptions] = useState<CoreOptionsUI>(() => ({
    ...DEFAULT_CORE_OPTIONS,
    ...initial,
  }));
  return { options, setOptions } as const;
}
