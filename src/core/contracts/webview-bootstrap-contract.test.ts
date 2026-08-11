import { describe, expect, it } from 'vitest';
import {
  isGitReviewWebviewBootstrap,
  isWebviewBootstrap,
  type GitReviewWebviewStrings,
  type WebviewStrings,
} from './webview-bootstrap-contract';

const strings: WebviewStrings = {
  eyebrow: 'Foundation',
  title: 'vscode-toolbox-namewta',
  description: 'Description',
  runtimeStatusTitle: 'Runtime status',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  loadingRuntimeInfo: 'Loading',
  extensionLabel: 'Extension',
  apiLabel: 'API',
  vscodeLabel: 'VS Code',
  nodeLabel: 'Node',
  languageLabel: 'Language',
  workspaceLabel: 'Workspace',
  environmentLabel: 'Environment',
  runtimeLabel: 'Runtime',
  toolsLabel: 'Tools',
  trusted: 'Trusted',
  restricted: 'Restricted',
  remote: 'Remote',
  local: 'Local',
  unknownError: 'Unknown error',
};

describe('Webview bootstrap contract', () => {
  it('accepts a complete, bounded bootstrap payload', () => {
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 10_000,
        strings,
      }),
    ).toBe(true);
  });

  it('rejects incomplete strings and unsafe timeouts', () => {
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 999,
        strings,
      }),
    ).toBe(false);
    expect(
      isWebviewBootstrap({
        version: 1,
        language: 'en',
        requestTimeoutMs: 10_000,
        strings: { title: 'Incomplete' },
      }),
    ).toBe(false);
  });
});

describe('Git Review Webview bootstrap contract', () => {
  it('accepts a validated aggregate review snapshot', () => {
    expect(
      isGitReviewWebviewBootstrap({
        version: 1,
        view: 'git-review',
        language: 'en',
        requestTimeoutMs: 10_000,
        strings: gitReviewStrings,
        snapshot: {
          state: 'active',
          session: {
            repositoryRoot: '/repository',
            currentItemId: 'unstaged:main.ts',
            currentItemPath: 'main.ts',
            items: [
              {
                itemId: 'unstaged:main.ts',
                layer: 'unstaged',
                path: 'main.ts',
                contentIdentity: 'a'.repeat(64),
                change: 'modified',
                presentation: 'text',
                reviewState: 'unreviewed',
              },
            ],
            progress: { total: 1, reviewed: 0, skipped: 0, remaining: 1 },
          },
        },
      }),
    ).toBe(true);
  });
});

const gitReviewStrings: GitReviewWebviewStrings = {
  title: 'Git Review',
  conflict: 'Conflicts',
  staged: 'Staged',
  unstaged: 'Changes',
  stage: 'Stage',
  unstage: 'Unstage',
  discard: 'Discard',
  openFile: 'Open',
  openDiff: 'Diff',
  copyReference: 'Copy',
  markReviewed: 'Reviewed',
  skip: 'Skip',
  mergeChanges: 'Merge',
  loading: 'Loading',
  retry: 'Retry',
  binary: 'Binary',
  submodule: 'Submodule',
  tooLarge: 'Too large',
  unavailable: 'Unavailable',
  noChanges: 'No changes',
  refreshRequired: 'Refresh',
  additions: 'additions',
  deletions: 'deletions',
};
