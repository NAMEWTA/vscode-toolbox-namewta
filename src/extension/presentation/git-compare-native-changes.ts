import type {
  GitCompareFileChange,
  GitCompareRevisionInput,
  GitCompareResult,
} from '../../core/domains/git-compare/public-api';

export type GitCompareNativeDocument =
  | {
      readonly kind: 'revision';
      readonly input: GitCompareRevisionInput;
    }
  | {
      readonly kind: 'summary';
      readonly endpoint: string;
      readonly path: string;
      readonly status: GitCompareFileChange['status'];
      readonly contentKind: Exclude<GitCompareFileChange['contentKind'], 'text'>;
    };

export type GitCompareNativeChange = {
  readonly labelPath: string;
  readonly original?: GitCompareNativeDocument;
  readonly modified?: GitCompareNativeDocument;
};

export function createGitCompareNativeChanges(
  repositoryRoot: string,
  result: GitCompareResult,
): readonly GitCompareNativeChange[] {
  return result.changes.map((change) => ({
    labelPath: change.path,
    ...(change.status === 'added'
      ? {}
      : {
          original: createDocument(
            repositoryRoot,
            result.base,
            change.previousPath ?? change.path,
            change,
          ),
        }),
    ...(change.status === 'deleted'
      ? {}
      : {
          modified: createDocument(repositoryRoot, result.target, change.path, change),
        }),
  }));
}

function createDocument(
  repositoryRoot: string,
  endpoint: string,
  path: string,
  change: GitCompareFileChange,
): GitCompareNativeDocument {
  return change.contentKind === 'text'
    ? {
        kind: 'revision',
        input: { repositoryRoot, ref: endpoint, path },
      }
    : {
        kind: 'summary',
        endpoint,
        path,
        status: change.status,
        contentKind: change.contentKind,
      };
}
