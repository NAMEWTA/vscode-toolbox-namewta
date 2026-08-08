import type { CopyReferenceInput } from '../../contracts/tool-command-contract';

export type {
  CopyPosition,
  CopyReferenceInput,
  CopyReferenceMode,
  CopyReferenceSource,
  CopySelectionSnapshot,
  ResourceSnapshot,
} from '../../contracts/tool-command-contract';

export type ClipboardPort = {
  writeText(text: string): Promise<void>;
};

export type CopyReferenceFormatter = (input: CopyReferenceInput) => string;
