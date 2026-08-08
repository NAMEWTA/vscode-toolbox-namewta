import type {
  RuntimeInfo,
  RuntimeInfoSnapshot,
} from '../../contracts/system-info-contract';

export type { RuntimeInfo, RuntimeInfoSnapshot };

export type RuntimeInfoPort = {
  readRuntimeInfo(): RuntimeInfoSnapshot;
};
