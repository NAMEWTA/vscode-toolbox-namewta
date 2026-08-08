import { readdir } from 'node:fs/promises';
import path from 'node:path';
import Mocha from 'mocha';

export async function run(): Promise<void> {
  const testsRoot = path.resolve(__dirname, '..', '..', '..');
  const testFiles = await findIntegrationTests(testsRoot);
  const mocha = new Mocha({
    color: true,
    timeout: 30_000,
    ui: 'tdd',
  });

  for (const testFile of testFiles) {
    mocha.addFile(testFile);
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failureCount: number) => {
      if (failureCount === 0) {
        resolve();
        return;
      }
      reject(new Error(`${failureCount} Extension Host test(s) failed.`));
    });
  });
}

async function findIntegrationTests(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findIntegrationTests(entryPath)));
      continue;
    }

    if (entry.name.endsWith('.integration.test.js')) {
      files.push(entryPath);
    }
  }

  return files.sort();
}
