import type { GeneratedArtifact } from '@preptex/core';
import { buildNewFileOutputs, normalizeOutputFolder } from './transformOutput';

function makeArtifact(path: string, source: string): GeneratedArtifact {
  return {
    path,
    source,
    provenance: {
      snapshotId: 'snap-1',
      viewId: null,
      request: { operation: 'suppress-comments', options: { target: 'source' } },
      operationVersion: 1,
    },
    origins: [],
    remainingInputs: [],
    topology: 'independent-sources',
  };
}

describe('transformOutput', () => {
  test('normalizeOutputFolder sanitizes slashes and rejects traversal segments', () => {
    expect(normalizeOutputFolder('')).toBe('');
    expect(normalizeOutputFolder('  /out/clean/  ')).toBe('out/clean');
    expect(normalizeOutputFolder('build\\nested')).toBe('build/nested');
    expect(normalizeOutputFolder('../escape')).toBeNull();
    expect(normalizeOutputFolder('out/../bad')).toBeNull();
    expect(normalizeOutputFolder('./same')).toBeNull();
  });

  test('buildNewFileOutputs writes all artifacts inside an output folder preserving structure', () => {
    const result = buildNewFileOutputs({
      artifacts: [makeArtifact('main.tex', 'Clean main'), makeArtifact('intro/ch1.tex', 'Clean ch1')],
      existingFiles: { 'main.tex': 'Orig', 'intro/ch1.tex': 'Orig ch1' },
      entryPath: 'main.tex',
      outputFolder: 'clean/v1',
    });

    expect(result.primaryPath).toBe('clean/v1/main.tex');
    expect(result.files).toEqual({
      'clean/v1/main.tex': 'Clean main',
      'clean/v1/intro/ch1.tex': 'Clean ch1',
    });
  });

  test('buildNewFileOutputs creates non-colliding sibling *.transformed.tex files when folder is omitted', () => {
    const result = buildNewFileOutputs({
      artifacts: [makeArtifact('main.tex', 'Clean main'), makeArtifact('intro/ch1.tex', 'Orig ch1')],
      existingFiles: {
        'main.tex': 'Orig',
        'main.transformed.tex': 'Older run',
        'intro/ch1.tex': 'Orig ch1',
      },
      changedPaths: new Set(['main.tex']),
      entryPath: 'main.tex',
      outputFolder: '',
    });

    expect(result.primaryPath).toBe('main.transformed-2.tex');
    expect(result.files).toEqual({
      'main.transformed-2.tex': 'Clean main',
    });
  });
});
