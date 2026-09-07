import { createZipArchive, readZipFileNames } from './zip';

describe('ZIP Archive Utility', () => {
  it('creates a valid ZIP archive containing text files', () => {
    const files = [
      { path: 'main.tex', content: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}' },
      { path: 'sections/intro.tex', content: '\\section{Introduction}\nContent here.' },
    ];

    const zipBytes = createZipArchive(files);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(0);

    // Verify PK signature at beginning (PK\x03\x04)
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);

    // Read back file names from the central directory
    const names = readZipFileNames(zipBytes);
    expect(names).toEqual(['main.tex', 'sections/intro.tex']);
  });

  it('supports empty archive', () => {
    const zipBytes = createZipArchive([]);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(readZipFileNames(zipBytes)).toEqual([]);
  });

  it('handles UTF-8 paths and content correctly', () => {
    const files = [
      { path: 'résumé/données.tex', content: '% Données avec accents: café, naïve, élève' },
    ];
    const zipBytes = createZipArchive(files);
    const names = readZipFileNames(zipBytes);
    expect(names).toEqual(['résumé/données.tex']);
  });
});
