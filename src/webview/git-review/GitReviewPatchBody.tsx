import type { JSX } from 'react';
import type {
  GitReviewWebviewAction,
  GitReviewWebviewStrings,
} from '../../core/contracts';
import type {
  GitReviewDiffLine,
  GitReviewItem,
  GitReviewItemPatch,
} from '../../core/domains/git-review/public-api';

export type GitReviewItemAction = (
  name: GitReviewWebviewAction['action'],
  line?: number,
) => void;

export function GitReviewPatchBody({
  patch,
  item,
  strings,
  action,
}: {
  readonly patch: GitReviewItemPatch | undefined;
  readonly item: GitReviewItem;
  readonly strings: GitReviewWebviewStrings;
  readonly action: GitReviewItemAction;
}): JSX.Element {
  if (patch === undefined) {
    return <div className="diff-state">{strings.unavailable}</div>;
  }
  if (patch.kind === 'summary') {
    return <div className="diff-state">{summaryLabel(patch.reason, strings)}</div>;
  }
  if (patch.hunks.length === 0) {
    return <div className="diff-state">{strings.noChanges}</div>;
  }
  return (
    <div className="patch-body">
      {patch.hunks.map((hunk, hunkIndex) => (
        <section className="diff-hunk" key={`${hunk.header}:${hunkIndex}`}>
          <div className="hunk-header">{hunk.header}</div>
          {hunk.lines.map((line, lineIndex) => (
            <GitReviewDiffLineView
              key={`${hunkIndex}:${lineIndex}`}
              line={line}
              item={item}
              action={action}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function GitReviewDiffLineView({
  line,
  item,
  action,
}: {
  readonly line: GitReviewDiffLine;
  readonly item: GitReviewItem;
  readonly action: GitReviewItemAction;
}): JSX.Element {
  const referenceLine = line.newLine ?? line.oldLine;
  return (
    <div className={`diff-line diff-line--${line.kind}`}>
      <button
        className="line-number"
        disabled={referenceLine === undefined || item.change === 'deleted'}
        onClick={() => action('copy-reference', referenceLine)}
      >
        {line.oldLine ?? ''}
      </button>
      <button
        className="line-number"
        disabled={referenceLine === undefined}
        onClick={() => action('copy-reference', referenceLine)}
      >
        {line.newLine ?? ''}
      </button>
      <span className="line-marker">{lineMarker(line.kind)}</span>
      <code>{line.text || ' '}</code>
    </div>
  );
}

function summaryLabel(
  reason: Extract<GitReviewItemPatch, { readonly kind: 'summary' }>['reason'],
  strings: GitReviewWebviewStrings,
): string {
  return {
    conflict: strings.conflict,
    binary: strings.binary,
    submodule: strings.submodule,
    'too-large': strings.tooLarge,
    unavailable: strings.unavailable,
  }[reason];
}

function lineMarker(kind: GitReviewDiffLine['kind']): string {
  if (kind === 'addition') {
    return '+';
  }
  return kind === 'deletion' ? '-' : ' ';
}
