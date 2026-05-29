export interface NumberPadProps {
  /** remaining[d] = how many of digit d are still to be placed (index 1..9). */
  remaining: number[];
  notesMode: boolean;
  onPick: (digit: number) => void;
}

export function NumberPad({ remaining, notesMode, onPick }: NumberPadProps) {
  return (
    <div className="pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const left = remaining[d] ?? 0;
        const done = left <= 0;
        return (
          <button
            key={d}
            type="button"
            className={"key" + (done ? " done" : "")}
            onClick={() => onPick(d)}
            disabled={done && !notesMode}
          >
            <span className="d">{d}</span>
            <span className="left">{done ? "✓" : left}</span>
          </button>
        );
      })}
    </div>
  );
}
