export type LogPanelProps = {
  notes?: string[];
  error?: string;
};

export default function LogPanel({ notes = [], error }: LogPanelProps) {
  const hasEntries = Boolean(error) || notes.length > 0;

  return (
    <section className="LogPanel" aria-label="Processing log">
      <div className="LogPanelBody" role="log" aria-live="polite">
        {!hasEntries ? <p className="LogPanelEmpty">No notes from the latest processing run.</p> : null}
        {error ? <div className="LogPanelEntry LogPanelEntry--error">{error}</div> : null}
        {notes.map((note, index) => (
          <div className="LogPanelEntry" key={`${index}-${note}`}>
            {note}
          </div>
        ))}
      </div>
    </section>
  );
}
