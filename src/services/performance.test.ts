import {
  createProjectSnapshotAdapter,
  planTransformationAdapter,
  resolveProjectViewAdapter,
  runAnalysisAdapter,
} from './core';
import { createZipArchive } from './zip';

describe('Phase W7: Performance Budget and Responsiveness Measurement', () => {
  const fileCount = 10;
  const files = Array.from({ length: fileCount }, (_, i) => ({
    path: `sections/section_${i}.tex`,
    version: 1,
    source: `\\section{Section ${i}}\n% Comment in section ${i}\n\\label{sec:${i}}\nReference to next: \\ref{sec:${(i + 1) % fileCount}}\nText content for section ${i}.\n`,
  }));

  const mainSource =
    '\\documentclass{article}\n\\begin{document}\n' +
    Array.from({ length: fileCount }, (_, i) => `\\input{sections/section_${i}.tex}\n`).join('') +
    '\\end{document}';

  const projectFiles = [
    { path: 'main.tex', version: 1, source: mainSource },
    ...files,
  ];

  it('meets responsiveness budget (< 100ms) for snapshot, view resolution, analysis, transformation, and ZIP export', () => {
    // 1. Snapshot creation
    const t0 = performance.now();
    const snapshot = createProjectSnapshotAdapter(projectFiles);
    const tSnapshot = performance.now() - t0;
    expect(snapshot.files.length).toBe(fileCount + 1);
    expect(tSnapshot).toBeLessThan(100);

    // 2. View resolution
    const t1 = performance.now();
    const view = resolveProjectViewAdapter(snapshot, { entryPath: 'main.tex' });
    const tView = performance.now() - t1;
    expect(view.status).toBe('ready');
    expect(tView).toBeLessThan(100);

    if (view.status !== 'ready') return;

    // 3. Reference analysis
    const t2 = performance.now();
    const analysis = runAnalysisAdapter(view, { operation: 'references' });
    const tAnalysis = performance.now() - t2;
    expect(analysis.kind).toBe('findings');
    expect(tAnalysis).toBeLessThan(100);

    // 4. Transformation planning (comment suppression)
    const t3 = performance.now();
    const transformResult = planTransformationAdapter(view, {
      operation: 'suppress-comments',
      options: { target: 'selected' },
    });
    const tTransform = performance.now() - t3;
    expect(transformResult.kind).toBe('transformation');
    expect(tTransform).toBeLessThan(100);

    // 5. ZIP creation
    const t4 = performance.now();
    const zipArchive = createZipArchive(
      projectFiles.map((f) => ({ path: f.path, content: f.source })),
    );
    const tZip = performance.now() - t4;
    expect(zipArchive.length).toBeGreaterThan(0);
    expect(tZip).toBeLessThan(100);
  });
});
