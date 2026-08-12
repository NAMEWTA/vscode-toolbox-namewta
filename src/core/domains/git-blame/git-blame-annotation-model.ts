import type { GitCancellationSignal } from './git-blame-port';
import type {
  ExecutableGitResource,
  GitBlameAnnotationsInput,
  GitBlameLine,
} from './git-blame-model';

export type GitBlameDataRequest = Pick<
  GitBlameAnnotationsInput,
  'resource' | 'ref' | 'ignoreWhitespace'
> & {
  readonly contents?: string;
};

export type GitBlameDataResult =
  | {
      readonly status: 'available';
      readonly lines: readonly GitBlameLine[];
      readonly remoteUrl?: string;
    }
  | {
      readonly status: 'unavailable';
      readonly reason: 'empty' | 'not-repository' | 'untracked';
    };

export type GitBlameDataPort = {
  getAnnotations(
    request: GitBlameDataRequest,
    signal: GitCancellationSignal,
  ): Promise<GitBlameDataResult>;
};

export function isBlameDataComplete(
  lines: readonly GitBlameLine[],
  expectedLineCount: number,
): boolean {
  // VS Code 会把末尾换行后的空行计入 lineCount，Git blame 不为该终端空行生成记录。
  const hasOnlyTerminalEmptyLine =
    lines.length > 0 && lines.length + 1 === expectedLineCount;
  return (
    (lines.length === expectedLineCount || hasOnlyTerminalEmptyLine) &&
    lines.every((line, index) => line.line === index + 1)
  );
}

export type { ExecutableGitResource, GitBlameLine };
