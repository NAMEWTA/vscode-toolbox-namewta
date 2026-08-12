import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  GitCommandPort,
  GitCommandRequest,
  GitCommandResult,
} from '../../../core/domains/git-blame/public-api';
import { ApplicationError } from '../../../core/kernel/application-error';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1_024 * 1_024;
const DEFAULT_MAX_INPUT_BYTES = 64 * 1_024 * 1_024;
const FORCE_KILL_DELAY_MS = 1_000;

export type GitSpawnOptions = {
  readonly cwd: string;
  readonly shell: false;
  readonly windowsHide: true;
  readonly stdio: ['ignore' | 'pipe', 'pipe', 'pipe'];
};

export type SpawnedGitProcess = {
  readonly stdin: NodeJS.WritableStream | null;
  readonly stdout: NodeJS.ReadableStream;
  readonly stderr: NodeJS.ReadableStream;
  once(event: 'error', listener: (error: Error) => void): SpawnedGitProcess;
  once(
    event: 'close',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): SpawnedGitProcess;
  kill(signal?: NodeJS.Signals | number): boolean;
};

export type GitProcessFactory = (
  command: 'git',
  args: readonly string[],
  options: GitSpawnOptions,
) => SpawnedGitProcess;

const spawnGit: GitProcessFactory = (command, args, options) =>
  options.stdio[0] === 'pipe'
    ? spawn(command, [...args], { ...options, stdio: ['pipe', 'pipe', 'pipe'] })
    : spawn(command, [...args], { ...options, stdio: ['ignore', 'pipe', 'pipe'] });

export class GitCommandRunner implements GitCommandPort {
  public constructor(private readonly processFactory: GitProcessFactory = spawnGit) {}

  public run(request: GitCommandRequest): Promise<GitCommandResult> {
    validateRequest(request);
    if (request.signal?.aborted === true) {
      return Promise.reject(operationError('cancelled', request.operation));
    }

    let process: SpawnedGitProcess;
    try {
      process = this.processFactory('git', request.args, {
        cwd: request.cwd,
        shell: false,
        windowsHide: true,
        stdio: [request.stdinText === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      });
    } catch (error: unknown) {
      return Promise.reject(mapSpawnError(error, request.operation));
    }
    return observeProcess(process, request);
  }
}

function observeProcess(
  process: SpawnedGitProcess,
  request: GitCommandRequest,
): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    let terminalError: ApplicationError | undefined;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const terminate = (error: ApplicationError): void => {
      if (terminalError !== undefined) {
        return;
      }
      terminalError = error;
      process.kill('SIGTERM');
      forceKillTimer = setTimeout(() => process.kill('SIGKILL'), FORCE_KILL_DELAY_MS);
    };
    const output = observeOutput(
      process,
      request.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      () => terminate(operationError('capability-unavailable', request.operation)),
    );
    const handleAbort = (): void =>
      terminate(operationError('cancelled', request.operation));
    const timeoutTimer = setTimeout(
      () => terminate(operationError('timeout', request.operation)),
      request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    request.signal?.addEventListener?.('abort', handleAbort, { once: true });

    process.once('error', (error) => {
      terminalError ??= mapSpawnError(error, request.operation);
    });
    writeSnapshotInput(process, request, terminate);
    process.once('close', (code) => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer !== undefined) {
        clearTimeout(forceKillTimer);
      }
      request.signal?.removeEventListener?.('abort', handleAbort);
      if (terminalError !== undefined) {
        reject(terminalError);
        return;
      }
      if (code !== 0) {
        reject(
          new ApplicationError('Git operation failed.', {
            code: 'internal-error',
            details: { operation: request.operation, exitCode: code },
          }),
        );
        return;
      }
      resolve({
        stdout: Buffer.concat(output.stdoutChunks).toString('utf8'),
        stdoutBytes: output.stdoutBytes,
        stderrBytes: output.stderrBytes,
      });
    });
  });
}

function writeSnapshotInput(
  process: SpawnedGitProcess,
  request: GitCommandRequest,
  terminate: (error: ApplicationError) => void,
): void {
  if (request.stdinText === undefined) return;
  const stdin = process.stdin;
  if (stdin === null) {
    terminate(operationError('capability-unavailable', request.operation));
    return;
  }
  stdin.once('error', (error) => terminate(mapSpawnError(error, request.operation)));
  try {
    stdin.end(request.stdinText);
  } catch (error: unknown) {
    terminate(mapSpawnError(error, request.operation));
  }
}

type GitOutputState = {
  readonly stdoutChunks: Buffer[];
  stdoutBytes: number;
  stderrBytes: number;
};

function observeOutput(
  process: SpawnedGitProcess,
  maxOutputBytes: number,
  onLimitExceeded: () => void,
): GitOutputState {
  const state: GitOutputState = { stdoutChunks: [], stdoutBytes: 0, stderrBytes: 0 };
  process.stdout.on('data', (chunk: Buffer | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    state.stdoutBytes += buffer.byteLength;
    if (state.stdoutBytes + state.stderrBytes > maxOutputBytes) {
      onLimitExceeded();
      return;
    }
    state.stdoutChunks.push(buffer);
  });
  process.stderr.on('data', (chunk: Buffer | string) => {
    state.stderrBytes += Buffer.byteLength(chunk);
    if (state.stdoutBytes + state.stderrBytes > maxOutputBytes) {
      onLimitExceeded();
    }
  });
  return state;
}

function validateRequest(request: GitCommandRequest): void {
  if (
    request.operation.length === 0 ||
    !path.isAbsolute(request.cwd) ||
    request.args.some((argument) => argument.includes('\0')) ||
    (request.stdinText !== undefined &&
      Buffer.byteLength(request.stdinText) > DEFAULT_MAX_INPUT_BYTES) ||
    (request.timeoutMs !== undefined && request.timeoutMs <= 0) ||
    (request.maxOutputBytes !== undefined && request.maxOutputBytes <= 0)
  ) {
    throw new ApplicationError('Git command request is invalid.', {
      code: 'invalid-input',
      details: { operation: request.operation },
    });
  }
}

function mapSpawnError(error: unknown, operation: string): ApplicationError {
  const code =
    isErrnoException(error) && error.code === 'ENOENT'
      ? 'capability-unavailable'
      : 'internal-error';
  return new ApplicationError('Git process could not be started.', {
    code,
    details: { operation },
    cause: error,
  });
}

function operationError(
  code: 'cancelled' | 'timeout' | 'capability-unavailable',
  operation: string,
): ApplicationError {
  return new ApplicationError('Git operation did not complete.', {
    code,
    details: { operation },
  });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
