import { Copy, ExternalLink, History, X } from 'lucide-react';
import { useEffect, useRef, type JSX, type KeyboardEvent, type RefObject } from 'react';
import type { GitBlameReaderBlock } from '../../core/domains/git-blame/public-api';
import type { GitBlameReaderWebviewStrings } from './GitBlameReaderApp';

type CommitDetailDialogProps = {
  readonly block: GitBlameReaderBlock;
  readonly canOpenRemote: boolean;
  readonly strings: GitBlameReaderWebviewStrings;
  readonly onClose: () => void;
  readonly onCopy: (format: 'commit-sha' | 'commit-info') => void;
  readonly onAction: (action: 'open-remote' | 'open-previous') => void;
};

export function CommitDetailDialog({
  block,
  canOpenRemote,
  strings,
  onClose,
  onCopy,
  onAction,
}: CommitDetailDialogProps): JSX.Element {
  const dialogRef = useDialogFocusTrap();

  return (
    <div className="blame-reader-dialog-backdrop">
      <div
        ref={dialogRef}
        className="blame-reader-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blame-reader-dialog-title"
        onKeyDown={(event) => handleDialogKeyDown(event, dialogRef, onClose)}
      >
        <header className="blame-reader-dialog-header">
          <h2 id="blame-reader-dialog-title">{strings.commitDetailTitle}</h2>
          <button
            type="button"
            className="blame-reader-icon-button"
            aria-label={strings.closeCommitDetails}
            title={strings.closeCommitDetails}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <CommitDetailFields block={block} strings={strings} />
        <CommitDetailActions
          canOpenRemote={canOpenRemote}
          strings={strings}
          onCopy={onCopy}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

function CommitDetailFields({
  block,
  strings,
}: Pick<CommitDetailDialogProps, 'block' | 'strings'>): JSX.Element {
  const affectedLines =
    block.startLine === block.endLine
      ? String(block.startLine)
      : `${block.startLine}-${block.endLine}`;
  return (
    <dl className="blame-reader-dialog-details">
      <dt>{strings.commitSha}</dt>
      <dd className="blame-reader-dialog-sha">{block.commit}</dd>
      <dt>{strings.author}</dt>
      <dd>{`${block.author} <${block.email}>`}</dd>
      <dt>{strings.authoredAt}</dt>
      <dd>{new Date(block.authoredAt * 1_000).toISOString()}</dd>
      <dt>{strings.affectedLines}</dt>
      <dd>{affectedLines}</dd>
      <dt>{strings.summary}</dt>
      <dd>{block.summary}</dd>
    </dl>
  );
}

function CommitDetailActions({
  canOpenRemote,
  strings,
  onCopy,
  onAction,
}: Pick<
  CommitDetailDialogProps,
  'canOpenRemote' | 'strings' | 'onCopy' | 'onAction'
>): JSX.Element {
  return (
    <footer className="blame-reader-dialog-actions">
      <button type="button" onClick={() => onCopy('commit-sha')}>
        <Copy size={14} aria-hidden="true" />
        {strings.copyCommitSha}
      </button>
      <button type="button" onClick={() => onCopy('commit-info')}>
        <Copy size={14} aria-hidden="true" />
        {strings.copyCommitInfo}
      </button>
      {canOpenRemote ? (
        <button type="button" onClick={() => onAction('open-remote')}>
          <ExternalLink size={14} aria-hidden="true" />
          {strings.openRemoteCommit}
        </button>
      ) : null}
      <button type="button" onClick={() => onAction('open-previous')}>
        <History size={14} aria-hidden="true" />
        {strings.openPreviousRevision}
      </button>
    </footer>
  );
}

function useDialogFocusTrap(): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus.current?.focus();
  }, []);
  return dialogRef;
}

function handleDialogKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  dialogRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key === 'Tab') trapDialogTab(event, dialogRef.current);
}

function trapDialogTab(
  event: KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null,
): void {
  const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
  const first = buttons?.[0];
  const last = buttons?.[buttons.length - 1];
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
