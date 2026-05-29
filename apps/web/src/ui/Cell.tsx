import { memo } from "react";

export type CellVariant = "given" | "user" | "hint" | "err" | null;
export type CellHighlight = "sel" | "same" | "peer" | null;

export interface CellProps {
  index: number;
  value: number;
  notes: number[];
  variant: CellVariant;
  highlight: CellHighlight;
  /** thick border on the right (box column boundary) */
  borderRight: boolean;
  /** thick border on the bottom (box row boundary) */
  borderBottom: boolean;
  onSelect: (index: number) => void;
}

function CellInner({
  index,
  value,
  notes,
  variant,
  highlight,
  borderRight,
  borderBottom,
  onSelect,
}: CellProps) {
  const cls = ["cell"];
  if (borderBottom) cls.push("br");
  if (borderRight) cls.push("bc");
  if (highlight) cls.push(highlight);
  if (value && variant) cls.push(variant);

  return (
    <button type="button" className={cls.join(" ")} onClick={() => onSelect(index)}>
      {value ? (
        value
      ) : notes.length ? (
        <div className="notes">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <span key={n}>{notes.includes(n) ? n : ""}</span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export const Cell = memo(CellInner);
