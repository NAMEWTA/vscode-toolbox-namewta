import { isFullCommitHash } from './git-blame-model';

type ParsedRemote = {
  readonly host: string;
  readonly pathSegments: readonly string[];
};

export function createGitRemoteCommitUrl(
  remote: string,
  commit: string,
): string | undefined {
  if (!isFullCommitHash(commit)) {
    return undefined;
  }
  const parsed = parseRemote(remote);
  if (parsed === undefined || !isSupportedPath(parsed)) {
    return undefined;
  }
  const repositoryPath = parsed.pathSegments.join('/');
  switch (parsed.host) {
    case 'github.com':
    case 'gitee.com':
      return `https://${parsed.host}/${repositoryPath}/commit/${commit}`;
    case 'gitlab.com':
      return `https://${parsed.host}/${repositoryPath}/-/commit/${commit}`;
    case 'bitbucket.org':
      return `https://${parsed.host}/${repositoryPath}/commits/${commit}`;
    default:
      return undefined;
  }
}

function parseRemote(remote: string): ParsedRemote | undefined {
  if (!isSafeRemoteText(remote)) {
    return undefined;
  }
  const scp = /^git@([^/:]+):(.+)$/u.exec(remote);
  if (scp !== null) {
    return createParsedRemote(scp[1], scp[2]);
  }
  return parseUrlRemote(remote);
}

function parseUrlRemote(remote: string): ParsedRemote | undefined {
  const url = /^(https?|ssh|git):\/\/([^/]+)\/(.+)$/iu.exec(remote);
  if (url === null) {
    return undefined;
  }
  const scheme = url[1]?.toLowerCase();
  const authority = url[2] ?? '';
  const path = url[3];
  if (path === undefined || authority.includes(':')) {
    return undefined;
  }
  const authorityParts = authority.split('@');
  if (authorityParts.length > 2) {
    return undefined;
  }
  const host = authorityParts.at(-1);
  const user = authorityParts.length === 2 ? authorityParts[0] : undefined;
  if (host === undefined || !isAllowedUser(scheme, user)) {
    return undefined;
  }
  return createParsedRemote(host, path);
}

function isSafeRemoteText(remote: string): boolean {
  return remote.length > 0 && remote.length <= 2_048 && !/[?#\0]/u.test(remote);
}

function isAllowedUser(scheme: string | undefined, user: string | undefined): boolean {
  if (scheme === 'ssh') {
    return user === undefined || user === 'git';
  }
  return user === undefined;
}

function createParsedRemote(
  hostValue: string | undefined,
  pathValue: string | undefined,
): ParsedRemote | undefined {
  if (hostValue === undefined || pathValue === undefined || pathValue.includes('\\')) {
    return undefined;
  }
  const host = hostValue.toLowerCase();
  const path = pathValue.replace(/\/$/u, '').replace(/\.git$/iu, '');
  const pathSegments = path.split('/');
  if (
    !/^[a-z\d.-]+$/u.test(host) ||
    pathSegments.some(
      (segment) => !/^[A-Za-z\d._-]+$/u.test(segment) || segment === '..',
    )
  ) {
    return undefined;
  }
  return { host, pathSegments };
}

function isSupportedPath(remote: ParsedRemote): boolean {
  if (remote.host === 'gitlab.com') {
    return remote.pathSegments.length >= 2;
  }
  return (
    ['github.com', 'bitbucket.org', 'gitee.com'].includes(remote.host) &&
    remote.pathSegments.length === 2
  );
}
