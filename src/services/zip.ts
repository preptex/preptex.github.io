/**
 * Zero-dependency client-side ZIP (PKZIP 2.0 Store) creation and reading utilities.
 */

// Precomputed CRC-32 table using IEEE 802.3 polynomial
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

export function calculateCrc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte !== undefined) {
      crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function getUtf8Encoder(): { encode: (text: string) => Uint8Array } {
  if (typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    return { encode: (text: string) => encoder.encode(text) };
  }
  return {
    encode: (text: string): Uint8Array => {
      const codePoints: number[] = [];
      for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
          const next = text.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
            i++;
          }
        }
        if (code < 0x80) {
          codePoints.push(code);
        } else if (code < 0x800) {
          codePoints.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
          codePoints.push(
            0xe0 | (code >> 12),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f)
          );
        } else {
          codePoints.push(
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f)
          );
        }
      }
      return new Uint8Array(codePoints);
    },
  };
}

function getUtf8Decoder(): { decode: (bytes: Uint8Array) => string } {
  if (typeof TextDecoder !== 'undefined') {
    const decoder = new TextDecoder('utf-8');
    return { decode: (bytes: Uint8Array) => decoder.decode(bytes) };
  }
  return {
    decode: (bytes: Uint8Array): string => {
      let str = '';
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i++];
        if (b === undefined) break;
        if (b < 0x80) {
          str += String.fromCharCode(b);
        } else if ((b & 0xe0) === 0xc0) {
          const b2 = bytes[i++] ?? 0;
          str += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
        } else if ((b & 0xf0) === 0xe0) {
          const b2 = bytes[i++] ?? 0;
          const b3 = bytes[i++] ?? 0;
          str += String.fromCharCode(
            ((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
          );
        } else {
          const b2 = bytes[i++] ?? 0;
          const b3 = bytes[i++] ?? 0;
          const b4 = bytes[i++] ?? 0;
          const cp =
            ((b & 0x07) << 18) |
            ((b2 & 0x3f) << 12) |
            ((b3 & 0x3f) << 6) |
            (b4 & 0x3f);
          str += String.fromCodePoint(cp);
        }
      }
      return str;
    },
  };
}

export interface ZipFileInput {
  readonly path: string;
  readonly content: string | Uint8Array;
}

/**
 * Creates a standard PKZIP archive (Store / uncompressed) containing the provided files.
 */
export function createZipArchive(files: readonly ZipFileInput[]): Uint8Array {
  const encoder = getUtf8Encoder();

  interface PreparedFile {
    readonly pathBytes: Uint8Array;
    readonly dataBytes: Uint8Array;
    readonly crc: number;
    readonly localHeaderOffset: number;
  }

  const prepared: PreparedFile[] = [];
  let currentOffset = 0;

  // Measure total size required
  let totalLocalSize = 0;
  let totalCentralDirSize = 0;

  for (const file of files) {
    const pathBytes = encoder.encode(file.path.replace(/\\/g, '/'));
    const dataBytes =
      typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = calculateCrc32(dataBytes);

    const localHeaderOffset = currentOffset;
    const localEntrySize = 30 + pathBytes.length + dataBytes.length;
    currentOffset += localEntrySize;
    totalLocalSize += localEntrySize;

    const centralEntrySize = 46 + pathBytes.length;
    totalCentralDirSize += centralEntrySize;

    prepared.push({
      pathBytes,
      dataBytes,
      crc,
      localHeaderOffset,
    });
  }

  const eocdSize = 22;
  const totalArchiveSize = totalLocalSize + totalCentralDirSize + eocdSize;
  const buffer = new Uint8Array(totalArchiveSize);
  const view = new DataView(buffer.buffer);

  let writePos = 0;

  // 1. Write Local File Headers + File Data
  for (const file of prepared) {
    // Local file header signature (0x04034b50)
    view.setUint32(writePos, 0x04034b50, true);
    // Version needed to extract (2.0 = 20)
    view.setUint16(writePos + 4, 20, true);
    // General purpose bit flag: bit 11 set for UTF-8 (0x0800)
    view.setUint16(writePos + 6, 0x0800, true);
    // Compression method: 0 = Store (no compression)
    view.setUint16(writePos + 8, 0, true);
    // Last mod file time / date
    view.setUint16(writePos + 10, 0, true);
    view.setUint16(writePos + 12, 0, true);
    // CRC-32
    view.setUint32(writePos + 14, file.crc, true);
    // Compressed size
    view.setUint32(writePos + 18, file.dataBytes.length, true);
    // Uncompressed size
    view.setUint32(writePos + 22, file.dataBytes.length, true);
    // File name length
    view.setUint16(writePos + 26, file.pathBytes.length, true);
    // Extra field length
    view.setUint16(writePos + 28, 0, true);

    writePos += 30;
    buffer.set(file.pathBytes, writePos);
    writePos += file.pathBytes.length;

    buffer.set(file.dataBytes, writePos);
    writePos += file.dataBytes.length;
  }

  const centralDirStartOffset = writePos;

  // 2. Write Central Directory Headers
  for (const file of prepared) {
    // Central file header signature (0x02014b50)
    view.setUint32(writePos, 0x02014b50, true);
    // Version made by: UNIX / UTF-8 = 20
    view.setUint16(writePos + 4, 20, true);
    // Version needed to extract = 20
    view.setUint16(writePos + 6, 20, true);
    // General purpose bit flag (UTF-8)
    view.setUint16(writePos + 8, 0x0800, true);
    // Compression method: Store
    view.setUint16(writePos + 10, 0, true);
    // File time / date
    view.setUint16(writePos + 12, 0, true);
    view.setUint16(writePos + 14, 0, true);
    // CRC-32
    view.setUint32(writePos + 16, file.crc, true);
    // Compressed size
    view.setUint32(writePos + 20, file.dataBytes.length, true);
    // Uncompressed size
    view.setUint32(writePos + 24, file.dataBytes.length, true);
    // File name length
    view.setUint16(writePos + 28, file.pathBytes.length, true);
    // Extra field length
    view.setUint16(writePos + 30, 0, true);
    // File comment length
    view.setUint16(writePos + 32, 0, true);
    // Disk number start
    view.setUint16(writePos + 34, 0, true);
    // Internal file attributes
    view.setUint16(writePos + 36, 0, true);
    // External file attributes
    view.setUint32(writePos + 38, 0, true);
    // Relative offset of local header
    view.setUint32(writePos + 42, file.localHeaderOffset, true);

    writePos += 46;
    buffer.set(file.pathBytes, writePos);
    writePos += file.pathBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  const centralDirSize = writePos - centralDirStartOffset;

  // EOCD signature (0x06054b50)
  view.setUint32(writePos, 0x06054b50, true);
  // Number of this disk (0)
  view.setUint16(writePos + 4, 0, true);
  // Disk where central directory starts (0)
  view.setUint16(writePos + 6, 0, true);
  // Number of central directory records on this disk
  view.setUint16(writePos + 8, prepared.length, true);
  // Total number of central directory records
  view.setUint16(writePos + 10, prepared.length, true);
  // Size of central directory
  view.setUint32(writePos + 12, centralDirSize, true);
  // Offset of start of central directory
  view.setUint32(writePos + 16, centralDirStartOffset, true);
  // Comment length (0)
  view.setUint16(writePos + 20, 0, true);

  return buffer;
}

/**
 * Reads all file names from the Central Directory of a ZIP archive.
 */
export function readZipFileNames(zipBytes: Uint8Array): readonly string[] {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const decoder = getUtf8Decoder();

  // Find EOCD by scanning backwards from end (EOCD is at least 22 bytes)
  if (zipBytes.byteLength < 22) {
    return [];
  }

  let eocdOffset = -1;
  for (let i = zipBytes.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return [];
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  const fileNames: string[] = [];

  for (let entry = 0; entry < totalEntries; entry++) {
    if (cdOffset + 46 > zipBytes.byteLength) {
      break;
    }
    const signature = view.getUint32(cdOffset, true);
    if (signature !== 0x02014b50) {
      break;
    }

    const nameLength = view.getUint16(cdOffset + 28, true);
    const extraLength = view.getUint16(cdOffset + 30, true);
    const commentLength = view.getUint16(cdOffset + 32, true);

    const nameBytes = zipBytes.slice(cdOffset + 46, cdOffset + 46 + nameLength);
    fileNames.push(decoder.decode(nameBytes));

    cdOffset += 46 + nameLength + extraLength + commentLength;
  }

  return fileNames;
}

/**
 * Initiates a browser download for a Blob and revokes its object URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates and downloads a ZIP archive from the given list of files.
 */
export function downloadZipArchive(
  files: readonly ZipFileInput[],
  zipFilename: string
): void {
  const bytes = createZipArchive(files);
  const blob = new Blob([bytes], { type: 'application/zip' });
  downloadBlob(blob, zipFilename);
}
