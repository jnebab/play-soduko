import { I, Svg } from "../icons.js";

export interface ControlsProps {
  notesMode: boolean;
  canUndo: boolean;
  /** Hints remaining; when undefined the Hint button is hidden (arena). */
  hintsLeft?: number;
  onUndo: () => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint?: () => void;
}

export function Controls({
  notesMode,
  canUndo,
  hintsLeft,
  onUndo,
  onErase,
  onToggleNotes,
  onHint,
}: ControlsProps) {
  const showHint = hintsLeft !== undefined && onHint !== undefined;
  return (
    <div className="actions">
      <button type="button" className="act" onClick={onUndo} disabled={!canUndo}>
        <span className="ring">
          <Svg d={I.undo} w={21} />
        </span>
        <span className="lbl">Undo</span>
      </button>
      <button type="button" className="act" onClick={onErase}>
        <span className="ring">
          <Svg d={I.erase} w={21} />
        </span>
        <span className="lbl">Erase</span>
      </button>
      <button
        type="button"
        className={"act" + (notesMode ? " on" : "")}
        onClick={onToggleNotes}
        aria-pressed={notesMode}
      >
        <span className="ring">
          <Svg d={I.pencil} w={21} />
          {notesMode && <span className="pill">ON</span>}
        </span>
        <span className="lbl">Notes</span>
      </button>
      {showHint && (
        <button type="button" className="act" onClick={onHint} disabled={hintsLeft <= 0}>
          <span className="ring">
            <Svg d={I.bulb} w={21} />
            {hintsLeft > 0 && <span className="badge">{hintsLeft}</span>}
          </span>
          <span className="lbl">Hint</span>
        </button>
      )}
    </div>
  );
}
