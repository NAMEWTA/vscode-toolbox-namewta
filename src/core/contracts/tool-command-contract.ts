import type { RuntimeInfo } from './system-info-contract';
import {
  isFullCommitHash,
  isGitBlameAnnotationsInput,
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
  'gitBlame.getCommitChanges',
  'gitBlame.getHistoricalContent',
  'gitBlame.getLineHistory',
  'system.getRuntimeInfo',
] as const satisfies readonly ToolCommandId[];

export function isToolCommandId(value: unknown): value is ToolCommandId {
  return (
    typeof value === 'string' && TOOL_COMMAND_IDS.some((command) => command === value)
  );
}

export function isToolCommandInput<TCommand extends ToolCommandId>(
  command: TCommand,
  input: unknown,
): input is ToolCommandInput<TCommand> {
  switch (command) {
    case 'copyReference.copy':
      return isCopyReferenceInput(input);
    case 'gitBlame.copyCommitHash':
      return isGitCopyCommitHashInput(input);
    case 'gitBlame.getAnnotations':
      return isGitBlameAnnotationsInput(input);
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

function isGitCopyCommitHashInput(value: unknown): value is GitCopyCommitHashInput {
  return isRecordWithKeys(value, ['hash']) && isFullCommitHash(value.hash);
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
