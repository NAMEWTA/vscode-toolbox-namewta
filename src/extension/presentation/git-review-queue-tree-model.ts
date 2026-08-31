import type {
  GitReviewItem,
  GitReviewLayer,
  GitReviewSession,
} from '../../core/domains/git-review/public-api';

export type GitReviewQueueLayerNode = {
  readonly kind: 'layer';
  readonly layer: GitReviewLayer;
  readonly itemCount: number;
  readonly children: GitReviewQueueTreeNode[];
};

export type GitReviewQueueDirectoryNode = {
  readonly kind: 'directory';
  readonly layer: GitReviewLayer;
  readonly name: string;
  readonly path: string;
  readonly parent: GitReviewQueueLayerNode | GitReviewQueueDirectoryNode;
  readonly children: GitReviewQueueTreeNode[];
};

export type GitReviewQueueItemNode = {
  readonly kind: 'item';
  readonly item: GitReviewItem;
  readonly isCurrent: boolean;
  readonly parent: GitReviewQueueLayerNode | GitReviewQueueDirectoryNode;
};

export type GitReviewQueueTreeNode =
  | GitReviewQueueLayerNode
  | GitReviewQueueDirectoryNode
  | GitReviewQueueItemNode;

type DirectoryDraft = {
  readonly name: string;
  readonly path: string;
  readonly directories: Map<string, DirectoryDraft>;
  readonly items: GitReviewItem[];
};

const LAYER_ORDER: readonly GitReviewLayer[] = ['conflict', 'staged', 'unstaged'];

export function createGitReviewQueueTree(
  session: GitReviewSession,
): GitReviewQueueLayerNode[] {
  return LAYER_ORDER.flatMap((layer) => {
    const items = session.items.filter((item) => item.layer === layer);
    if (items.length === 0) return [];
    const draft = createDirectoryDraft('', '');
    for (const item of items) addItem(draft, item);
    const root: GitReviewQueueLayerNode = {
      kind: 'layer',
      layer,
      itemCount: items.length,
      children: [],
    };
    root.children.push(...createChildren(draft, root, session.currentItemId));
    return [root];
  });
}

function addItem(root: DirectoryDraft, item: GitReviewItem): void {
  const parts = item.path.split('/');
  let directory = root;
  for (const name of parts.slice(0, -1)) {
    let child = directory.directories.get(name);
    if (child === undefined) {
      const path = directory.path === '' ? name : `${directory.path}/${name}`;
      child = createDirectoryDraft(name, path);
      directory.directories.set(name, child);
    }
    directory = child;
  }
  directory.items.push(item);
}

function createDirectoryDraft(name: string, path: string): DirectoryDraft {
  return { name, path, directories: new Map(), items: [] };
}

function createChildren(
  draft: DirectoryDraft,
  parent: GitReviewQueueLayerNode | GitReviewQueueDirectoryNode,
  currentItemId: string,
): GitReviewQueueTreeNode[] {
  const directories = [...draft.directories.values()]
    .sort((left, right) => compareText(left.name, right.name))
    .map((directory) => createDirectoryNode(directory, parent, currentItemId));
  const items = [...draft.items]
    .sort((left, right) => compareText(left.path, right.path))
    .map<GitReviewQueueItemNode>((item) => ({
      kind: 'item',
      item,
      isCurrent: item.itemId === currentItemId,
      parent,
    }));
  return [...directories, ...items];
}

function createDirectoryNode(
  initial: DirectoryDraft,
  parent: GitReviewQueueLayerNode | GitReviewQueueDirectoryNode,
  currentItemId: string,
): GitReviewQueueDirectoryNode {
  let draft = initial;
  const names = [draft.name];
  while (draft.items.length === 0 && draft.directories.size === 1) {
    draft = [...draft.directories.values()][0]!;
    names.push(draft.name);
  }
  const node: GitReviewQueueDirectoryNode = {
    kind: 'directory',
    layer: parent.layer,
    name: names.join('/'),
    path: draft.path,
    parent,
    children: [],
  };
  node.children.push(...createChildren(draft, node, currentItemId));
  return node;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
