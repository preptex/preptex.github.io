import React, { useEffect, useMemo, useRef, useState } from 'react';

export type FiletreeProps = {
  files: string[];
  selected?: string;
  onSelect: (filename: string) => void;
  onDownload?: (filename: string) => void;
  onRemove?: (filename: string) => void;
  onUploadFiles?: (files: FileList) => void;
};

type FiletreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FiletreeNode[];
};

type TreeNodeProps = {
  node: FiletreeNode;
  depth: number;
  selected?: string;
  onSelect: (filename: string) => void;
  onDownload?: (filename: string) => void;
  onRemove?: (filename: string) => void;
};

function shortenFilenameMiddle(filename: string, maxLength = 30): string {
  if (filename.length <= maxLength) return filename;

  const lastDot = filename.lastIndexOf('.');
  const hasExt = lastDot > 0 && lastDot < filename.length - 1;
  const ext = hasExt ? filename.slice(lastDot) : '';
  const base = hasExt ? filename.slice(0, lastDot) : filename;

  const ellipsis = '...';
  const remaining = maxLength - ext.length - ellipsis.length;

  const headLen = 5 + Math.ceil(remaining / 2);
  const tailLen = remaining - headLen;
  return base.slice(0, headLen) + ellipsis + base.slice(Math.max(0, base.length - tailLen)) + ext;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function sortNodes(a: FiletreeNode, b: FiletreeNode): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function buildFiletree(files: string[]): FiletreeNode[] {
  const root: FiletreeNode = { name: '', path: '', type: 'folder', children: [] };

  for (const filename of files) {
    const normalized = normalizePath(filename);
    if (!normalized) continue;

    const parts = normalized.split('/').filter(Boolean);
    let cursor = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      const type = isFile ? 'file' : 'folder';

      let child = cursor.children?.find((item) => item.name === part && item.type === type);
      if (!child) {
        child = {
          name: part,
          path: isFile ? normalized : path,
          type,
          children: isFile ? undefined : [],
        };
        cursor.children = [...(cursor.children ?? []), child];
      }

      if (!isFile) {
        cursor = child;
      }
    });
  }

  const sortRecursive = (nodes: FiletreeNode[]): FiletreeNode[] =>
    nodes
      .map((node) => ({
        ...node,
        children: node.children ? sortRecursive(node.children) : undefined,
      }))
      .sort(sortNodes);

  return sortRecursive(root.children ?? []);
}

function TreeNode({ node, depth, selected, onSelect, onDownload, onRemove }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === 'folder';
  const isActive = selected === node.path;

  const toggleOrSelect = () => {
    if (isFolder) {
      setOpen((value) => !value);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div className="FiletreeNode">
      <div
        className={isActive ? 'FiletreeRow FiletreeRow--active' : 'FiletreeRow'}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          className="ControlItem FiletreeItem"
          onClick={toggleOrSelect}
          title={node.path}
          aria-expanded={isFolder ? open : undefined}
        >
          <span className="FiletreeChevron" aria-hidden="true">
            {isFolder ? (open ? 'v' : '>') : ''}
          </span>
          <span className={isFolder ? 'FiletreeName FiletreeName--folder' : 'FiletreeName'}>
            {isFolder ? node.name : shortenFilenameMiddle(node.name)}
          </span>
        </button>

        {!isFolder && onDownload ? (
          <button
            type="button"
            className="ControlItem FiletreeAction"
            aria-label={`Download ${node.path}`}
            title={`Download ${node.path}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownload(node.path);
            }}
          >
            Download
          </button>
        ) : null}

        {!isFolder && onRemove ? (
          <button
            type="button"
            className="ControlItem FiletreeAction FiletreeAction--remove"
            aria-label={`Remove ${node.path}`}
            title={`Remove ${node.path}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(node.path);
            }}
          >
            Remove
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
              onSelect={onSelect}
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
  onSelect,
  onDownload,
  onRemove,
  onUploadFiles,
}: FiletreeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const tree = useMemo(() => buildFiletree(files), [files]);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const triggerPicker = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const triggerFolderPicker = () => {
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
      folderInputRef.current.click();
    }
  };

  const onFilesChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const fl = e.target.files;
    if (fl && onUploadFiles) {
      onUploadFiles(fl);
    }
  };

  return (
    <section aria-label="File tree">
      <h2>Filetree</h2>
      {onUploadFiles ? (
        <div className="FiletreeActions">
          <button type="button" className="ControlItem FiletreeUpload" onClick={triggerPicker}>
            Upload files...
          </button>
          <button type="button" className="ControlItem FiletreeUpload" onClick={triggerFolderPicker}>
            Upload folder...
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={onFilesChange}
            style={{ display: 'none' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            onChange={onFilesChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : null}
      <div className="FiletreeList" role="tree">
        {files.length === 0 ? (
          <div className="PaneMeta">No files</div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={`${node.type}:${node.path}`}
              node={node}
              depth={0}
              selected={selected}
              onSelect={onSelect}
              onDownload={onDownload}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </section>
  );
}
