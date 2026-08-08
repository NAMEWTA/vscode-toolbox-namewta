import type { JSX } from 'react';
import type { WebviewStrings } from '../../core/contracts';
import { RuntimeStatusCard } from '../features/runtime-status/RuntimeStatusCard';
import { useRuntimeInfo } from '../features/runtime-status/use-runtime-info';
import type { ToolMessageClient } from '../platform/webview-message-client';

export type ToolboxAppProps = {
  readonly client: ToolMessageClient;
  readonly strings: WebviewStrings;
};

export function ToolboxApp({ client, strings }: ToolboxAppProps): JSX.Element {
  const runtimeInfo = useRuntimeInfo(client, strings.unknownError);

  return (
    <main className="toolbox-shell">
      <header className="toolbox-hero">
        <p className="toolbox-eyebrow">{strings.eyebrow}</p>
        <h1>{strings.title}</h1>
        <p>{strings.description}</p>
      </header>
      <RuntimeStatusCard
        state={runtimeInfo.state}
        onRefresh={runtimeInfo.refresh}
        strings={strings}
      />
    </main>
  );
}
