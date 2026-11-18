export interface DroppedFileItem {
  readonly file: File;
  readonly relativePath: string;
  readonly fromDirectory?: boolean;
}

interface WebKitEntryLike {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  file?: (success: (file: File) => void, error?: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: WebKitEntryLike[]) => void, error?: (err: unknown) => void) => void;
  };
}

interface DataTransferItemWithEntry {
  webkitGetAsEntry?: () => WebKitEntryLike | null;
  getAsFile?: () => File | null;
}

function readAllDirectoryEntries(entry: WebKitEntryLike): Promise<WebKitEntryLike[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader?.();
    if (!reader) {
      resolve([]);
      return;
    }
    const collected: WebKitEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(collected);
            return;
          }
          collected.push(...batch);
          readBatch();
        },
        () => resolve(collected),
      );
    };
    readBatch();
  });
}

async function traverseEntry(
  entry: WebKitEntryLike,
  prefix: string,
  fromDirectory = false,
): Promise<DroppedFileItem[]> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile && entry.file) {
    return new Promise((resolve) => {
      entry.file!(
        (file) => resolve([{ file, relativePath: path, fromDirectory }]),
        () => resolve([]),
      );
    });
  }
  if (entry.isDirectory) {
    const children = await readAllDirectoryEntries(entry);
    const nested = await Promise.all(children.map((child) => traverseEntry(child, path, true)));
    return nested.flat();
  }
  return [];
}

export async function extractDroppedFiles(dataTransfer: DataTransfer | null): Promise<DroppedFileItem[]> {
  if (!dataTransfer) return [];

  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items
    .map((item) => (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is WebKitEntryLike => entry !== null);

  if (entries.length > 0) {
    const traversed = await Promise.all(entries.map((entry) => traverseEntry(entry, '', false)));
    const flat = traversed.flat();
    if (flat.length > 0) return flat;
  }

  return Array.from(dataTransfer.files).map((file) => {
    const relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    return {
      file,
      relativePath,
      fromDirectory: Boolean(file.webkitRelativePath && file.webkitRelativePath.includes('/')),
    };
  });
}
