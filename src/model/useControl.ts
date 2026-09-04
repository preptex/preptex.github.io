import { useState } from 'react';
import { InputHandlingMode } from '@preptex/core';
import type { ConditionName } from '@preptex/core';

export interface CoreOptionsUI {
  readonly suppressComments: boolean;
  readonly inputHandling: InputHandlingMode;
  readonly handleIfConditions: boolean;
  readonly enabledConditions: readonly ConditionName[];
  readonly outputName: string;
}

export const DEFAULT_CORE_OPTIONS: CoreOptionsUI = {
  suppressComments: false,
  inputHandling: InputHandlingMode.Preserve,
  handleIfConditions: false,
  enabledConditions: [],
  outputName: '',
};

export function useControl(initial?: Partial<CoreOptionsUI>) {
  const [options, setOptions] = useState<CoreOptionsUI>(() => ({
    ...DEFAULT_CORE_OPTIONS,
    ...initial,
  }));
  return { options, setOptions } as const;
}
