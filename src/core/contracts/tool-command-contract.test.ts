import { describe, expect, it } from 'vitest';
import { isToolCommandId, isToolCommandInput } from './tool-command-contract';

describe('tool command contract', () => {
  it('accepts registered command identifiers', () => {
    expect(isToolCommandId('system.getRuntimeInfo')).toBe(true);
    expect(isToolCommandId('system.unknown')).toBe(false);
    expect(isToolCommandId(undefined)).toBe(false);
  });

  it('validates the runtime-info input as an empty record', () => {
    expect(isToolCommandInput('system.getRuntimeInfo', {})).toBe(true);
    expect(isToolCommandInput('system.getRuntimeInfo', { extra: true })).toBe(false);
    expect(isToolCommandInput('system.getRuntimeInfo', null)).toBe(false);
    expect(isToolCommandInput('system.getRuntimeInfo', [])).toBe(false);
  });

  it('validates copy-reference snapshots without accepting untrusted extra shapes', () => {
    const validInput = {
      mode: 'relative',
      source: {
        kind: 'explorer',
        resources: [
          {
            scheme: 'file',
            authority: '',
            path: '/workspace/main.ts',
            absolute: '/workspace/main.ts',
          },
        ],
      },
      workspaceFolders: [],
    } as const;

    expect(isToolCommandId('copyReference.copy')).toBe(true);
    expect(isToolCommandInput('copyReference.copy', validInput)).toBe(true);
    expect(
      isToolCommandInput('copyReference.copy', {
        ...validInput,
        source: { kind: 'explorer', resources: [] },
      }),
    ).toBe(false);
    expect(
      isToolCommandInput('copyReference.copy', { ...validInput, mode: 'paste' }),
    ).toBe(false);
  });

  it('recognizes Git Blame commands without reporting unregistered handlers as capabilities', () => {
    for (const command of [
      'gitBlame.getAnnotations',
      'gitBlame.getLineHistory',
      'gitBlame.getCommitChanges',
      'gitBlame.getHistoricalContent',
      'gitBlame.copyCommitHash',
    ]) {
      expect(isToolCommandId(command)).toBe(true);
    }
  });

  it('rejects traversal, abbreviated hashes and invalid Git options at the Gateway boundary', () => {
    const resource = {
      repositoryRoot: '/workspace/repo',
      relativePath: 'src/main.ts',
    } as const;
    expect(
      isToolCommandInput('gitBlame.copyCommitHash', { hash: 'a'.repeat(40) }),
    ).toBe(true);
    expect(isToolCommandInput('gitBlame.copyCommitHash', { hash: 'abc123' })).toBe(
      false,
    );
    expect(
      isToolCommandInput('gitBlame.getHistoricalContent', {
        resource,
        ref: '-c',
        path: '../secret.txt',
      }),
    ).toBe(false);
  });
});
