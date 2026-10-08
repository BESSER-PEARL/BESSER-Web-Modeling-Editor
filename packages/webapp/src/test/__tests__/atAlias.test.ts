import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as viaAlias from '@/main/shared/utils/markTextEditable';
import * as viaRelative from '../../main/shared/utils/markTextEditable';
import { resolveAtPath } from '../../../atAlias';

// The Windows fix (forward-slash ids, so Rollup never bundles one file twice)
// lived only in vite.config.ts; vitest.config.ts kept its own resolver copy
// that still returned backslash ids. Both configs now share atAlias.ts.
describe('@/ alias', () => {
  const root = path.resolve(__dirname, '../../..');

  it('returns forward-slash ids', () => {
    const id = resolveAtPath('main/shared/utils/markTextEditable', path.join(root, 'src/main/app/x.ts'));
    expect(id).not.toContain('\\');
    expect(id.endsWith('/packages/webapp/src/main/shared/utils/markTextEditable.ts')).toBe(true);
  });

  it('resolves against the library for library importers', () => {
    const id = resolveAtPath('utils/autoLayout', path.join(root, '../library/lib/besser-editor.tsx'));
    expect(id.endsWith('/packages/library/lib/utils/autoLayout.ts')).toBe(true);
  });

  it('loads one module instance for alias and relative imports', () => {
    expect(viaAlias).toBe(viaRelative);
  });
});
