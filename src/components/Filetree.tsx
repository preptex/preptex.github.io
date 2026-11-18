import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { extractDroppedFiles, type DroppedFileItem } from '../utils/dropEntries';
import './Filetree.css';

export interface FiletreeProps {
  readonly files: string[];
  readonly selected?: string;
  readonly entryPath?: string | null;
  readonly onSelect?: (path: string) => void;
  readonly onSetEntry?: (path: string) => void;
  readonly onCreateFile?: (path: string) => void;
  readonly onDownload?: (path: string) => void;
  readonly onRemove?: (path: string) => void;
  readonly onUploadFiles?: (files: FileList) => void;
  readonly onUploadFolder?: (files: FileList) => void;
  readonly onDropFiles?: (items: readonly DroppedFileItem[]) => void;
  readonly uploadError?: string | null;
  readonly uploadNotice?: string | null;
  readonly onDismissUploadNotice?: () => void;
  readonly uploadFilesTrigger?: number;
  readonly uploadFolderTrigger?: number;
  readonly newFileTrigger?: number;
  readonly onCollapseSidebar?: () => void;
}

type FiletreeNode = {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FiletreeNode[];
};

const NAME_TRUNCATE_THRESHOLD = 28;
const NAME_KEEP_HEAD = 14;
const NAME_KEEP_TAIL = 10;

function shortenFilenameMiddle(name: string) {
  if (name.length <= NAME_TRUNCATE_THRESHOLD) return name;
  return `${name.slice(0, NAME_KEEP_HEAD)}...${name.slice(-NAME_KEEP_TAIL)}`;
}

function getFileExtensionBadge(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return 'file';
  return filename.slice(dot + 1).toLowerCase();
}

function buildFiletree(paths: string[]): FiletreeNode[] {
  const root: { folders: Map<string, FiletreeNode>; files: FiletreeNode[] } = {
    folders: new Map(),
    files: [],
  };

  for (const rawPath of paths) {
    const clean = rawPath.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    const parts = clean.split('/').filter(Boolean);

    let curr = root;
    let prefix = '';

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!part) continue;
      const isLast = i === parts.length - 1;
      prefix = prefix ? `${prefix}/${part}` : part;

      if (isLast) {
        curr.files.push({ name: part, path: prefix, type: 'file' });
      } else {
        const existingFolder = curr.folders.get(part);
        const folder: FiletreeNode = existingFolder ?? {
          name: part,
          path: prefix,
          type: 'folder',
          children: [],
        };
        if (!existingFolder) {
          curr.folders.set(part, folder);
        }
        const subFolders = new Map<string, FiletreeNode>();
        const subFiles: FiletreeNode[] = [];
        for (const c of folder.children ?? []) {
          if (c.type === 'folder') subFolders.set(c.name, c);
          else subFiles.push(c);
        }
        curr = {
          folders: subFolders,
          files: subFiles,
        };
        (folder as { _sub?: typeof curr })._sub = curr;
      }
    }
  }

  function finalize(nodeMap: typeof root): FiletreeNode[] {
    const folders = Array.from(nodeMap.folders.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => {
        const sub = (f as { _sub?: typeof root })._sub;
        return {
          name: f.name,
          path: f.path,
          type: 'folder' as const,
          children: sub ? finalize(sub) : [],
        };
      });

    const files = nodeMap.files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  }

  return finalize(root);
}

function collectFolderPaths(nodes: readonly FiletreeNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push(node.path);
      if (node.children) {
        result.push(...collectFolderPaths(node.children));
      }
    }
  }
  return result;
}

type TreeNodeProps = {
  readonly node: FiletreeNode;
  readonly depth: number;
  readonly selected?: string;
  readonly entryPath?: string | null;
  readonly expandedFolders: ReadonlySet<string>;
  readonly forceExpandAll: boolean;
  readonly onToggleFolder: (path: string) => void;
  readonly onSelect?: (path: string) => void;
  readonly onSetEntry?: (path: string) => void;
  readonly onDownload?: (path: string) => void;
  readonly onRemove?: (path: string) => void;
};

function TreeNode({
  node,
  depth,
  selected,
  entryPath,
  expandedFolders,
  forceExpandAll,
  onToggleFolder,
  onSelect,
  onSetEntry,
  onDownload,
  onRemove,
}: TreeNodeProps) {
  const isFolder = node.type === 'folder';
  const open = isFolder ? forceExpandAll || expandedFolders.has(node.path) : false;
  const isSelected = !isFolder && selected === node.path;
  const isEntry = !isFolder && entryPath === node.path;

  const toggleOrSelect = () => {
    if (isFolder) {
      onToggleFolder(node.path);
    } else {
      onSelect?.(node.path);
    }
  };

  return (
    <div>
      <div
        className={`FiletreeRow${isSelected ? ' is-selected' : ''}${isEntry ? ' is-entry' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? open : undefined}
      >
        <button
          type="button"
          className="FiletreeItem"
          onClick={toggleOrSelect}
          title={node.path}
          aria-expanded={isFolder ? open : undefined}
        >
          <span className="FiletreeChevron" aria-hidden="true">
            {isFolder ? (open ? '▾' : '▸') : ''}
          </span>
          <span className="FiletreeTypeIcon" aria-hidden="true">
            {isFolder ? '📁' : ''}
          </span>
          <span className={isFolder ? 'FiletreeName FiletreeName--folder' : 'FiletreeName'}>
            {isFolder ? node.name : shortenFilenameMiddle(node.name)}
          </span>
          {!isFolder && isEntry ? <span className="FiletreeEntryBadge">Entry</span> : null}
          {!isFolder && !isEntry ? (
            <span className="FiletreeExtBadge">{getFileExtensionBadge(node.name)}</span>
          ) : null}
        </button>

        {!isFolder && !isEntry && onSetEntry ? (
          <button
            type="button"
            className="FiletreeAction FiletreeAction--entry"
            aria-label={`Set ${node.path} as entry`}
            title={`Set ${node.path} as entry file`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSetEntry(node.path);
            }}
          >
            <span aria-hidden="true">★</span>
          </button>
        ) : null}

        {!isFolder && onDownload ? (
          <button
            type="button"
            className="FiletreeAction"
            aria-label={`Download ${node.path}`}
            title={`Download ${node.path}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownload(node.path);
            }}
          >
            <span aria-hidden="true">↓</span>
          </button>
        ) : null}

        {!isFolder && onRemove ? (
          <button
            type="button"
            className="FiletreeAction FiletreeAction--remove"
            aria-label={`Remove ${node.path}`}
            title={`Remove ${node.path}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(node.path);
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>

      {isFolder && open
        ? node.children?.map((child) => (
            <TreeNode
              key={`${child.type}:${child.path}`}
              node={child}
              depth={depth + 1}
              selected={selected}
              entryPath={entryPath}
              expandedFolders={expandedFolders}
              forceExpandAll={forceExpandAll}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
              onSetEntry={onSetEntry}
              onDownload={onDownload}
              onRemove={onRemove}
            />
          ))
        : null}
    </div>
  );
}

export default function Filetree({
  files,
  selected,
  entryPath,
  onSelect,
  onSetEntry,
  onCreateFile,
  onDownload,
  onRemove,
  onUploadFiles,
  onUploadFolder,
  onDropFiles,
  uploadError,
  uploadNotice,
  onDismissUploadNotice,
  uploadFilesTrigger,
  uploadFolderTrigger,
  newFileTrigger,
  onCollapseSidebar,
}: FiletreeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);

  const [filterText, setFilterText] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<ReadonlySet<string>>(() => new Set());

  const filteredFiles = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return files;
    return files.filter((path) => path.toLowerCase().includes(query));
  }, [files, filterText]);

  const tree = useMemo(() => buildFiletree(filteredFiles), [filteredFiles]);
  const allFolders = useMemo(() => collectFolderPaths(tree), [tree]);

  const expandedFolders = useMemo(() => {
    const set = new Set<string>();
    for (const folder of allFolders) {
      if (!collapsedFolders.has(folder)) {
        set.add(folder);
      }
    }
    return set;
  }, [allFolders, collapsedFolders]);

  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (uploadFilesTrigger && uploadFilesTrigger > 0) {
      inputRef.current?.click();
    }
  }, [uploadFilesTrigger]);

  useEffect(() => {
    if (uploadFolderTrigger && uploadFolderTrigger > 0) {
      folderInputRef.current?.click();
    }
  }, [uploadFolderTrigger]);

  useEffect(() => {
    if (newFileTrigger && newFileTrigger > 0 && onCreateFile) {
      setCreatingFile(true);
      window.setTimeout(() => newFileInputRef.current?.focus(), 0);
    }
  }, [newFileTrigger, onCreateFile]);

  const onFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0 && onUploadFiles) {
      onUploadFiles(fileList);
    }
    e.target.value = '';
  };

  const onFolderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      if (onUploadFolder) {
        onUploadFolder(fileList);
      } else if (onUploadFiles) {
        onUploadFiles(fileList);
      }
    }
    e.target.value = '';
  };

  const handleToggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedFolders(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedFolders(new Set(allFolders));
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = newFilePath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleaned || !onCreateFile) return;
    onCreateFile(cleaned);
    setNewFilePath('');
    setCreatingFile(false);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const items = await extractDroppedFiles(event.dataTransfer);
    if (items.length === 0) return;
    if (onDropFiles) {
      onDropFiles(items);
    } else if (onUploadFiles && event.dataTransfer.files.length > 0) {
      onUploadFiles(event.dataTransfer.files);
    }
  };

  return (
    <section
      className={`FiletreePane${isDragOver ? ' is-drag-over' : ''}`}
      aria-label="Files"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      <div className="FiletreeHeader">
        <div className="FiletreeHeaderTitleRow">
          <h2 className="FiletreeHeading">Explorer</h2>
          <span className="FiletreeCount">{files.length}</span>
        </div>
        <div className="FiletreeHeaderActions">
          {onCreateFile ? (
            <button
              type="button"
              className="FiletreeToolBtn"
              aria-label="New file"
              title="New file (supports subfolder paths like intro/history.tex)"
              onClick={() => {
                setCreatingFile((prev) => !prev);
                window.setTimeout(() => newFileInputRef.current?.focus(), 0);
              }}
            >
              + File
            </button>
          ) : null}
          {allFolders.length > 0 ? (
            <>
              <button
                type="button"
                className="FiletreeToolBtn"
                onClick={handleExpandAll}
                title="Expand all folders"
                aria-label="Expand all folders"
              >
                ⊞
              </button>
              <button
                type="button"
                className="FiletreeToolBtn"
                onClick={handleCollapseAll}
                title="Collapse all folders"
                aria-label="Collapse all folders"
              >
                ⊟
              </button>
            </>
          ) : null}
          {onCollapseSidebar ? (
            <button
              type="button"
              className="FiletreeToolBtn FiletreeToolBtn--collapse"
              onClick={onCollapseSidebar}
              title="Hide file explorer"
              aria-label="Hide file explorer"
            >
              «
            </button>
          ) : null}
        </div>
      </div>

      {onUploadFiles ? (
        <div className="FiletreeUpload">
          <button
            type="button"
            className="FiletreeUploadBtn"
            onClick={() => inputRef.current?.click()}
          >
            Upload files
          </button>
          <button
            type="button"
            className="FiletreeUploadBtn"
            onClick={() => folderInputRef.current?.click()}
          >
            Upload folder
          </button>
          <input
            ref={inputRef}
            aria-label="Upload files"
            type="file"
            multiple
            onChange={onFilesChange}
            style={{ display: 'none' }}
          />
          <input
            ref={folderInputRef}
            aria-label="Upload folder"
            type="file"
            multiple
            onChange={onFolderChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : null}

      <div className="FiletreeSearchRow">
        <input
          type="search"
          className="FiletreeSearchInput"
          aria-label="Filter files"
          placeholder="Filter files or folders…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {creatingFile && onCreateFile ? (
        <form className="FiletreeNewFileForm" onSubmit={handleCreateSubmit}>
          <input
            ref={newFileInputRef}
            type="text"
            className="FiletreeNewFileInput"
            aria-label="New file path"
            placeholder="e.g. intro/history.tex"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
          />
          <div className="FiletreeNewFileButtons">
            <button type="submit" className="FiletreeNewFileConfirm">
              Create
            </button>
            <button
              type="button"
              className="FiletreeNewFileCancel"
              onClick={() => {
                setCreatingFile(false);
                setNewFilePath('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {uploadError ? (
        <div className="FiletreeUploadError" role="alert">
          {uploadError}
        </div>
      ) : null}

      {uploadNotice ? (
        <div className="FiletreeUploadNotice" role="status">
          <span>{uploadNotice}</span>
          {onDismissUploadNotice ? (
            <button
              type="button"
              className="FiletreeUploadNoticeDismiss"
              aria-label="Dismiss upload notice"
              onClick={onDismissUploadNotice}
            >
              &times;
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="FiletreeList" role="tree">
        {files.length === 0 ? (
          <div className="FiletreeEmpty">Drop .tex files or folders here</div>
        ) : filteredFiles.length === 0 ? (
          <div className="FiletreeEmpty">No files matching &ldquo;{filterText}&rdquo;</div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={`${node.type}:${node.path}`}
              node={node}
              depth={0}
              selected={selected}
              entryPath={entryPath}
              expandedFolders={expandedFolders}
              forceExpandAll={filterText.trim().length > 0}
              onToggleFolder={handleToggleFolder}
              onSelect={onSelect}
              onSetEntry={onSetEntry}
              onDownload={onDownload}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </section>
  );
}
