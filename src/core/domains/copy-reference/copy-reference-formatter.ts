import type {
  CopyPosition,
  CopyReferenceInput,
  CopySelectionSnapshot,
  ResourceSnapshot,
} from './copy-reference-model';

export function formatCopyReference(input: CopyReferenceInput): string {
  const paths =
    input.source.kind === 'editor'
      ? [formatResource(input.source.resource, input)]
      : input.source.resources.map((resource) => formatResource(resource, input));

  if (input.source.kind === 'explorer') {
    return paths.length === 1
      ? `\`${paths[0]}\``
      : `\`\`\`\n${paths.join('\n')}\n\`\`\``;
  }

  return `\`${paths[0]}${formatSelection(input.source.selection)}\``;
}

function formatResource(resource: ResourceSnapshot, input: CopyReferenceInput): string {
  if (input.mode === 'absolute') {
    return absoluteRepresentation(resource);
  }

  const workspace = findDeepestWorkspace(resource, input.workspaceFolders);
  if (workspace === undefined) {
    return absoluteRepresentation(resource);
  }

  const relativePath = normalizedPath(resource.path).slice(
    normalizedPath(workspace.path).length,
  );
  return relativePath.replace(/^\/+/, '') || '.';
}

function findDeepestWorkspace(
  resource: ResourceSnapshot,
  workspaces: readonly ResourceSnapshot[],
): ResourceSnapshot | undefined {
  return workspaces
    .filter((workspace) => isResourceInsideWorkspace(resource, workspace))
    .sort((left, right) => right.path.length - left.path.length)[0];
}

function isResourceInsideWorkspace(
  resource: ResourceSnapshot,
  workspace: ResourceSnapshot,
): boolean {
  if (
    resource.scheme !== workspace.scheme ||
    resource.authority !== workspace.authority
  ) {
    return false;
  }

  const resourcePath = normalizedPathForComparison(resource);
  const workspacePath = normalizedPathForComparison(workspace);
  return (
    resourcePath === workspacePath ||
    (workspacePath === '/'
      ? resourcePath.startsWith('/')
      : resourcePath.startsWith(`${workspacePath}/`))
  );
}

function absoluteRepresentation(resource: ResourceSnapshot): string {
  if (resource.scheme === 'file') {
    return resource.absolute;
  }

  const authority = resource.authority === '' ? '' : `//${resource.authority}`;
  return `${resource.scheme}:${authority}${resource.path}`;
}

function formatSelection(selection: CopySelectionSnapshot): string {
  const [start, end] = normalizeSelection(selection);
  if (samePosition(start, end)) {
    return `:${start.line + 1}`;
  }
  if (start.line === end.line) {
    return `:${start.line + 1}(${start.character + 1}-${end.character})`;
  }
  const finalLine = end.character === 0 ? end.line - 1 : end.line;
  if (finalLine === start.line) {
    return `:${start.line + 1}`;
  }
  return `:${start.line + 1}-${finalLine + 1}`;
}

function normalizeSelection(
  selection: CopySelectionSnapshot,
): readonly [CopyPosition, CopyPosition] {
  return comparePosition(selection.anchor, selection.active) <= 0
    ? [selection.anchor, selection.active]
    : [selection.active, selection.anchor];
}

function comparePosition(left: CopyPosition, right: CopyPosition): number {
  return left.line === right.line
    ? left.character - right.character
    : left.line - right.line;
}

function samePosition(left: CopyPosition, right: CopyPosition): boolean {
  return left.line === right.line && left.character === right.character;
}

function normalizedPath(value: string): string {
  if (value === '/') {
    return value;
  }
  return value.replace(/\/+$/u, '');
}

function normalizedPathForComparison(resource: ResourceSnapshot): string {
  const path = normalizedPath(resource.path);
  // Windows 文件 URI 的盘符会被 VS Code 规范化，工作区 URI 则可能保留原始大小写。
  // 仅在可识别的本地盘符路径上忽略大小写，避免破坏区分大小写的远程 URI。
  return resource.scheme === 'file' && /^\/[A-Za-z]:\//u.test(path)
    ? path.toLowerCase()
    : path;
}
