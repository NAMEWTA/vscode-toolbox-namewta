import type { JSX } from 'react';
import type { WebviewStrings } from '../../../core/contracts';
import type { RuntimeInfoState } from './use-runtime-info';

export type RuntimeStatusCardProps = {
  readonly state: RuntimeInfoState;
  readonly onRefresh: () => void;
  readonly strings: WebviewStrings;
};

export function RuntimeStatusCard({
  state,
  onRefresh,
  strings,
}: RuntimeStatusCardProps): JSX.Element {
  return (
    <section className="toolbox-card" aria-labelledby="runtime-status-title">
      <div className="toolbox-card__header">
        <h2 id="runtime-status-title">{strings.runtimeStatusTitle}</h2>
        <button type="button" onClick={onRefresh} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? strings.refreshing : strings.refresh}
        </button>
      </div>

      {state.status === 'idle' || state.status === 'loading' ? (
        <p role="status">{strings.loadingRuntimeInfo}</p>
      ) : null}

      {state.status === 'error' ? (
        <p className="toolbox-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === 'success' ? (
        <RuntimeDetails info={state.data} strings={strings} />
      ) : null}
    </section>
  );
}

function RuntimeDetails({
  info,
  strings,
}: {
  readonly info: Extract<RuntimeInfoState, { status: 'success' }>['data'];
  readonly strings: WebviewStrings;
}): JSX.Element {
  return (
    <dl className="runtime-details">
      <RuntimeDetail label={strings.extensionLabel} value={info.extensionVersion} />
      <RuntimeDetail label={strings.apiLabel} value={String(info.apiVersion)} />
      <RuntimeDetail label={strings.vscodeLabel} value={info.vscodeVersion} />
      <RuntimeDetail label={strings.nodeLabel} value={info.nodeVersion} />
      <RuntimeDetail label={strings.languageLabel} value={info.uiLanguage} />
      <RuntimeDetail
        label={strings.workspaceLabel}
        value={info.isWorkspaceTrusted ? strings.trusted : strings.restricted}
      />
      <RuntimeDetail
        label={strings.environmentLabel}
        value={info.isRemoteEnvironment ? strings.remote : strings.local}
      />
      <RuntimeDetail label={strings.runtimeLabel} value={info.runtimeId} />
      <RuntimeDetail
        label={strings.toolsLabel}
        value={String(info.capabilities.length)}
      />
    </dl>
  );
}

function RuntimeDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="runtime-details__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
