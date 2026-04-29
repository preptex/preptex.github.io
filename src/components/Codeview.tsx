import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export type CodeviewProps = {
  filename?: string;
  code: string;
  /** 1-based line number to scroll to (best-effort). */
  jumpToLine?: number;
  /** Increment to force re-jump even if jumpToLine is unchanged. */
  jumpToken?: number;
};

export default function CodeMirrorView({ filename, code, jumpToLine, jumpToken }: CodeviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Mount editor once
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: code,
      extensions: [EditorView.editable.of(false)],
    });

    viewRef.current = new EditorView({
      state,
      parent: hostRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [code]);

  // Update document when code changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === code) return;

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: code,
      },
    });
  }, [code]);

  // Scroll to the requested 1-based line number.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (typeof jumpToLine !== 'number' || !Number.isFinite(jumpToLine)) return;

    const lineNumber = Math.max(1, Math.floor(jumpToLine));
    const doc = view.state.doc;
    if (!doc.length) return;

    const clampedLine = Math.min(lineNumber, doc.lines);
    const line = doc.line(clampedLine);
    const pos = line.from;

    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    });
  }, [jumpToLine, jumpToken, code]);

  return (
    <div className="CodeviewContainer">
      <div className="CodeviewHeader">
        <h2 className="CodeviewTitle">
          <span>Code</span>
          {filename ? <span className="CodeviewFilename">{filename}</span> : null}
        </h2>
      </div>
      <div className="CodeviewEditor" ref={hostRef} />
    </div>
  );
}
