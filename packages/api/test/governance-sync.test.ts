import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { GOVERNANCE_FILES } from '../scripts/governance-files.mjs';

const governanceRepo = process.env.GOVERNANCE_REPO_DIR;
const vendored = path.resolve(__dirname, '../governance');
const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe.skipIf(!governanceRepo)('vendored governance files', () => {
  for (const [from, to] of GOVERNANCE_FILES) {
    test(`${to} matches ${from}`, () => {
      expect(read(path.join(vendored, to))).toBe(read(path.join(governanceRepo!, from)));
    });
  }
});
