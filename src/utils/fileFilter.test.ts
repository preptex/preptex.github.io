import { act, renderHook } from '@testing-library/react';
import { filterUploadedBatch, isRelevantProjectFile } from './fileFilter';
import { useFiles } from '../model/useFiles';

describe('fileFilter', () => {
  test('accepts relevant TeX extensions and rejects build/VCS paths and binaries', () => {
    expect(isRelevantProjectFile('main.tex')).toBe(true);
    expect(isRelevantProjectFile('chapters/intro.TEX')).toBe(true);
    expect(isRelevantProjectFile('styles/custom.cls')).toBe(true);
    expect(isRelevantProjectFile('styles/macros.sty')).toBe(true);
    expect(isRelevantProjectFile('refs.bib')).toBe(true);
    expect(isRelevantProjectFile('figures/plot.tikz')).toBe(true);

    expect(isRelevantProjectFile('.git/config.tex')).toBe(false);
    expect(isRelevantProjectFile('paper/node_modules/pkg/doc.tex')).toBe(false);
    expect(isRelevantProjectFile('paper/.DS_Store')).toBe(false);
    expect(isRelevantProjectFile('paper/main.pdf')).toBe(false);
    expect(isRelevantProjectFile('paper/main.aux')).toBe(false);
    expect(isRelevantProjectFile('paper/fig.png')).toBe(false);
    expect(isRelevantProjectFile('paper/README.md')).toBe(false);
  });

  test('filterUploadedBatch summarizes accepted and skipped items', () => {
    const batch = filterUploadedBatch(
      [
        { path: 'proj/main.tex' },
        { path: 'proj/chapters/ch1.tex' },
        { path: 'proj/build/main.pdf' },
        { path: 'proj/.git/HEAD' },
      ],
      (item) => item.path,
    );

    expect(batch.accepted.map((item) => item.path)).toEqual([
      'proj/main.tex',
      'proj/chapters/ch1.tex',
    ]);
    expect(batch.skippedCount).toBe(2);
    expect(batch.skippedPaths).toEqual(['proj/build/main.pdf', 'proj/.git/HEAD']);
  });
});

describe('useFiles folder filtering', () => {
  test('filters folder uploads before reading file contents and reports skipped notice', async () => {
    const { result } = renderHook(() => useFiles());

    const texFile = new File(['\\section{Intro}'], 'main.tex', { type: 'text/plain' });
    Object.defineProperty(texFile, 'webkitRelativePath', { value: 'paper/main.tex' });
    const chapterFile = new File(['\\subsection{Ch1}'], 'ch1.tex', { type: 'text/plain' });
    Object.defineProperty(chapterFile, 'webkitRelativePath', { value: 'paper/chapters/ch1.tex' });

    const pdfFile = new File(['%PDF-1.7'], 'main.pdf', { type: 'application/pdf' });
    const pdfTextSpy = jest.fn(async () => '%PDF-1.7');
    Object.defineProperty(pdfFile, 'webkitRelativePath', { value: 'paper/main.pdf' });
    Object.defineProperty(pdfFile, 'text', { value: pdfTextSpy });

    await act(async () => {
      await result.current.upsertFiles([texFile, chapterFile, pdfFile], { filterExtensions: true });
    });

    expect(pdfTextSpy).not.toHaveBeenCalled();
    expect(result.current.fileNames).toEqual(['main.tex', 'chapters/ch1.tex']);
    expect(result.current.uploadError).toBeNull();
    expect(result.current.uploadNotice).toMatch(/skipped 1 non-tex file/i);
  });

  test('sets uploadError when folder drop contains no relevant TeX files', async () => {
    const { result } = renderHook(() => useFiles());
    const imageFile = new File(['png'], 'fig.png', { type: 'image/png' });

    await act(async () => {
      await result.current.upsertFileItems([
        { file: imageFile, relativePath: 'figures/fig.png', fromDirectory: true },
      ]);
    });

    expect(result.current.fileNames).toEqual([]);
    expect(result.current.uploadError).toMatch(/no supported tex files/i);
  });
});
