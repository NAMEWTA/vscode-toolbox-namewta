import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuntimeInfo } from '../../../core/domains/system-info/public-api';
import type { ToolMessageClient } from '../../platform/webview-message-client';

export type RuntimeInfoState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: RuntimeInfo }
  | { readonly status: 'error'; readonly message: string };

export function useRuntimeInfo(
  client: ToolMessageClient,
  unknownErrorMessage: string,
): {
  readonly state: RuntimeInfoState;
  readonly refresh: () => void;
} {
  const [state, setState] = useState<RuntimeInfoState>({ status: 'idle' });
  const generationRef = useRef(0);
  const activeControllerRef = useRef<AbortController | undefined>(undefined);

  const load = useCallback(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setState({ status: 'loading' });

    void client
      .execute('system.getRuntimeInfo', {}, controller.signal)
      .then((result) => {
        if (generationRef.current !== generation || controller.signal.aborted) {
          return;
        }

        if (result.ok) {
          setState({ status: 'success', data: result.data });
          return;
        }

        setState({ status: 'error', message: result.error.message });
      })
      .catch((error: unknown) => {
        if (generationRef.current !== generation || controller.signal.aborted) {
          return;
        }
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : unknownErrorMessage,
        });
      });
  }, [client, unknownErrorMessage]);

  useEffect(() => {
    load();
    return () => {
      generationRef.current += 1;
      activeControllerRef.current?.abort();
    };
  }, [load]);

  return { state, refresh: load };
}
