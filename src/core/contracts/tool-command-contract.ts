import type { RuntimeInfo } from './system-info-contract';
import {
  type GitReviewItemContent,
  type GitReviewItemContentInput,
  type GitReviewSessionSnapshot,
  type GitReviewStartInput,
} from '../domains/git-review/git-review-model';
/* eslint-disable max-lines */
import type {
  GitReviewItemActionInput,
  GitReviewItemPatch,
} from '../domains/git-review/git-review-patch-model';
import { isGitReviewToolCommandInput } from './git-review-tool-command-input';
import {
  isFullCommitHash,
  isGitBlameAnnotationsInput,
  isGitReference,
  isGitCommitChangesInput,
  isGitHistoricalContentInput,
  isGitLineHistoryInput,
  type GitBlameAnnotationsInput,
  type GitBlameAnnotationsResult,
  type GitCommitChangesInput,
  type GitCommitChangesResult,
  type GitCopyCommitHashInput,
  type GitHistoricalContentInput,
  type GitHistoricalContentResult,
  type GitLineHistoryInput,
  type GitLineHistoryPage,
} from '../domains/git-blame/git-blame-model';
import {
  type GitBlameReaderCopyFormat,
  type GitBlameReaderModel,
} from '../domains/git-blame/git-blame-reader-model';

export type {
  GitBlameAnnotationsInput,
  GitBlameAnnotationsResult,
  GitCommitChangesInput,
  GitCommitChangesResult,
  GitCopyCommitHashInput,
  GitHistoricalContentInput,
  GitHistoricalContentResult,
  GitLineHistoryInput,
  GitLineHistoryPage,
};
export type GitBlameReaderModelInput = {
  readonly resource: GitBlameAnnotationsInput['resource'];
  readonly sourceUri: string;
  readonly revision: string;
  readonly documentVersion: number;
  readonly lineCount: number;
  readonly ignoreWhitespace: boolean;
  readonly maxLines: number;
  readonly sourceText: string;
  readonly generation: number;
  readonly sourceLine: number;
};
export type GitBlameReaderCopyInput = {
  readonly generation: number;
  readonly format: GitBlameReaderCopyFormat;
  readonly line?: number;
  readonly blockId?: string;
};
export type { GitBlameReaderCopyFormat, GitBlameReaderModel };
export type {
  GitReviewItemContent,
  GitReviewItemContentInput,
  GitReviewItemActionInput,
  GitReviewItemPatch,
  GitReviewSessionSnapshot,
  GitReviewStartInput,
};

export type ResourceSnapshot = {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly absolute: string;
};

export type CopyPosition = {
  readonly line: number;
  readonly character: number;
};

export type CopySelectionSnapshot = {
  readonly anchor: CopyPosition;
  readonly active: CopyPosition;
};

export type CopyReferenceSource =
  | {
      readonly kind: 'editor';
      readonly resource: ResourceSnapshot;
      readonly selection: CopySelectionSnapshot;
    }
  | {
      readonly kind: 'explorer';
      readonly resources: readonly ResourceSnapshot[];
    };

export type CopyReferenceMode = 'relative' | 'absolute';

export type CopyReferenceInput = {
  readonly mode: CopyReferenceMode;
  readonly source: CopyReferenceSource;
  readonly workspaceFolders: readonly ResourceSnapshot[];
};

export type ToolCommandMap = {
  'copyReference.copy': {
    input: CopyReferenceInput;
    output: string;
  };
  'gitBlame.getAnnotations': {
    input: GitBlameAnnotationsInput;
    output: GitBlameAnnotationsResult;
  };
  'gitBlame.getReaderModel': {
    input: GitBlameReaderModelInput;
    output: GitBlameReaderModel;
  };
  'gitBlame.copyReader': {
    input: GitBlameReaderCopyInput;
    output: string;
  };
  'gitBlame.getLineHistory': {
    input: GitLineHistoryInput;
    output: GitLineHistoryPage;
  };
  'gitBlame.getCommitChanges': {
    input: GitCommitChangesInput;
    output: GitCommitChangesResult;
  };
  'gitBlame.getHistoricalContent': {
    input: GitHistoricalContentInput;
    output: GitHistoricalContentResult;
  };
  'gitBlame.copyCommitHash': {
    input: GitCopyCommitHashInput;
    output: string;
  };
  'gitReview.start': {
    input: GitReviewStartInput;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.previous': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.next': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.markReviewedAndNext': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.retry': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.skip': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.refresh': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.end': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.markStale': {
    input: Record<string, never>;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.getItemContent': {
    input: GitReviewItemContentInput;
    output: GitReviewItemContent;
  };
  'gitReview.getItemPatch': {
    input: GitReviewItemActionInput;
    output: GitReviewItemPatch;
  };
  'gitReview.stageItem': {
    input: GitReviewItemActionInput;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.unstageItem': {
    input: GitReviewItemActionInput;
    output: GitReviewSessionSnapshot;
  };
  'gitReview.discardItem': {
    input: GitReviewItemActionInput;
    output: GitReviewSessionSnapshot;
  };
  'system.getRuntimeInfo': {
    input: Record<string, never>;
    output: RuntimeInfo;
  };
};

export type ToolCommandId = keyof ToolCommandMap;

export type ToolCommandInput<TCommand extends ToolCommandId> =
  ToolCommandMap[TCommand]['input'];

export type ToolCommandOutput<TCommand extends ToolCommandId> =
  ToolCommandMap[TCommand]['output'];

export type ToolCapability = {
  readonly command: ToolCommandId;
  readonly available: boolean;
  readonly reason?: string;
};

const TOOL_COMMAND_IDS = [
  'copyReference.copy',
  'gitBlame.copyCommitHash',
  'gitBlame.getAnnotations',
  'gitBlame.getReaderModel',
  'gitBlame.copyReader',
  'gitBlame.getCommitChanges',
  'gitBlame.getHistoricalContent',
  'gitBlame.getLineHistory',
  'gitReview.end',
  'gitReview.getItemContent',
  'gitReview.getItemPatch',
  'gitReview.stageItem',
  'gitReview.unstageItem',
  'gitReview.discardItem',
  'gitReview.markReviewedAndNext',
  'gitReview.markStale',
  'gitReview.next',
  'gitReview.previous',
  'gitReview.refresh',
  'gitReview.retry',
  'gitReview.skip',
  'gitReview.start',
  'system.getRuntimeInfo',
] as const satisfies readonly ToolCommandId[];

type GitReviewCommandId = Extract<ToolCommandId, `gitReview.${string}`>;
type NonGitReviewCommandId = Exclude<ToolCommandId, GitReviewCommandId>;

export function isToolCommandId(value: unknown): value is ToolCommandId {
  return (
    typeof value === 'string' && TOOL_COMMAND_IDS.some((command) => command === value)
  );
}

export function isToolCommandInput<TCommand extends ToolCommandId>(
  command: TCommand,
  input: unknown,
): input is ToolCommandInput<TCommand> {
  if (isGitReviewCommand(command)) {
    return isGitReviewToolCommandInput(command, input);
  }
  return isNonGitReviewCommandInput(command, input);
}

function isNonGitReviewCommandInput(
  command: NonGitReviewCommandId,
  input: unknown,
): boolean {
  switch (command) {
    case 'copyReference.copy':
      return isCopyReferenceInput(input);
    case 'gitBlame.copyCommitHash':
      return isGitCopyCommitHashInput(input);
    case 'gitBlame.getAnnotations':
      return isGitBlameAnnotationsInput(input);
    case 'gitBlame.getReaderModel':
      return isGitBlameReaderModelInput(input);
    case 'gitBlame.copyReader':
      return isGitBlameReaderCopyInput(input);
    case 'gitBlame.getCommitChanges':
      return isGitCommitChangesInput(input);
    case 'gitBlame.getHistoricalContent':
      return isGitHistoricalContentInput(input);
    case 'gitBlame.getLineHistory':
      return isGitLineHistoryInput(input);
    case 'system.getRuntimeInfo':
      return isEmptyRecord(input);
  }
}

function isGitReviewCommand(command: ToolCommandId): command is GitReviewCommandId {
  return command.startsWith('gitReview.');
}

function isGitCopyCommitHashInput(value: unknown): value is GitCopyCommitHashInput {
  return isRecordWithKeys(value, ['hash']) && isFullCommitHash(value.hash);
}

// eslint-disable-next-line complexity
function isGitBlameReaderModelInput(value: unknown): value is GitBlameReaderModelInput {
  if (
    !isRecordWithKeys(value, [
      'resource',
      'sourceUri',
      'revision',
      'documentVersion',
      'lineCount',
      'ignoreWhitespace',
      'maxLines',
      'sourceText',
      'generation',
      'sourceLine',
    ])
  )
    return false;
  return (
    isGitBlameAnnotationsInput({
      resource: value.resource,
      documentVersion: value.documentVersion,
      lineCount: value.lineCount,
      ignoreWhitespace: value.ignoreWhitespace,
      maxLines: value.maxLines,
    }) &&
    isBoundedText(value.sourceUri, 8_192) &&
    isGitReference(value.revision) &&
    Number.isInteger(value.generation) &&
    Number(value.generation) > 0 &&
    Number.isInteger(value.sourceLine) &&
    Number(value.sourceLine) > 0 &&
    Number(value.sourceLine) <= Number(value.lineCount) &&
    typeof value.sourceText === 'string' &&
    !value.sourceText.includes('\0') &&
    value.sourceText.length <= 20_000_000
  );
}

// eslint-disable-next-line complexity
function isGitBlameReaderCopyInput(value: unknown): value is GitBlameReaderCopyInput {
  if (
    !isRecord(value) ||
    !('generation' in value) ||
    !('format' in value) ||
    !isReaderCopyFormat(value.format)
  )
    return false;
  const allowed = new Set(['generation', 'format', 'line', 'blockId']);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    Number.isInteger(value.generation) &&
    Number(value.generation) > 0 &&
    (value.line === undefined ||
      (Number.isInteger(value.line) &&
        Number(value.line) > 0 &&
        Number(value.line) <= 10_000_000)) &&
    (value.blockId === undefined ||
      (typeof value.blockId === 'string' &&
        value.blockId.length > 0 &&
        value.blockId.length <= 256 &&
        !value.blockId.includes('\0')))
  );
}

function isReaderCopyFormat(value: unknown): value is GitBlameReaderCopyFormat {
  return (
    value === 'code' ||
    value === 'line-with-blame' ||
    value === 'commit-sha' ||
    value === 'commit-info' ||
    value === 'block-code' ||
    value === 'block-with-blame' ||
    value === 'all-code' ||
    value === 'all-with-blame'
  );
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes('\0')
  );
}

function isCopyReferenceInput(value: unknown): value is CopyReferenceInput {
  if (!isRecordWithKeys(value, ['mode', 'source', 'workspaceFolders'])) {
    return false;
  }
  return (
    (value.mode === 'relative' || value.mode === 'absolute') &&
    isCopyReferenceSource(value.source) &&
    Array.isArray(value.workspaceFolders) &&
    value.workspaceFolders.every(isResourceSnapshot)
  );
}

function isCopyReferenceSource(value: unknown): value is CopyReferenceSource {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }
  if (value.kind === 'editor') {
    return (
      isRecordWithKeys(value, ['kind', 'resource', 'selection']) &&
      isResourceSnapshot(value.resource) &&
      isSelection(value.selection)
    );
  }
  return (
    value.kind === 'explorer' &&
    isRecordWithKeys(value, ['kind', 'resources']) &&
    Array.isArray(value.resources) &&
    value.resources.length > 0 &&
    value.resources.every(isResourceSnapshot)
  );
}

function isResourceSnapshot(value: unknown): value is ResourceSnapshot {
  return (
    isRecordWithKeys(value, ['scheme', 'authority', 'path', 'absolute']) &&
    typeof value.scheme === 'string' &&
    value.scheme.length > 0 &&
    typeof value.authority === 'string' &&
    typeof value.path === 'string' &&
    value.path.startsWith('/') &&
    typeof value.absolute === 'string' &&
    value.absolute.length > 0
  );
}

function isSelection(value: unknown): value is CopySelectionSnapshot {
  return (
    isRecordWithKeys(value, ['anchor', 'active']) &&
    isPosition(value.anchor) &&
    isPosition(value.active)
  );
}

function isPosition(value: unknown): value is CopyPosition {
  return (
    isRecordWithKeys(value, ['line', 'character']) &&
    Number.isInteger(value.line) &&
    Number(value.line) >= 0 &&
    Number.isInteger(value.character) &&
    Number(value.character) >= 0
  );
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}
