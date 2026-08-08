export type GitCancellationSignal = {
  readonly aborted: boolean;
  addEventListener?(
    type: 'abort',
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
};

export type GitCommandRequest = {
  readonly operation: string;
  readonly cwd: string;
  readonly args: readonly string[];
  readonly signal?: GitCancellationSignal;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
};

export type GitCommandResult = {
  readonly stdout: string;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
};

export type GitCommandPort = {
  run(request: GitCommandRequest): Promise<GitCommandResult>;
};
