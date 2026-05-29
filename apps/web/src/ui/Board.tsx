import { colOf, rowOf, type Board as BoardType, type Notes } from "@sudoku/engine";
import { Cell, type CellHighlight, type CellVariant } from "./Cell.js";

export interface BoardProps {
  board: BoardType;
  notes: Notes;
  given: boolean[];
  hintSet: Set<number>;
  conflicts: Set<number>;
  sel: number | null;
  onSelect: (index: number) => void;
}

export function Board({ board, notes, given, hintSet, conflicts, sel, onSelect }: BoardProps) {
  const selVal = sel != null ? (board[sel] ?? 0) : 0;
  const selR = sel != null ? rowOf(sel) : -1;
  const selC = sel != null ? colOf(sel) : -1;
  const selBR = sel != null ? Math.floor(selR / 3) : -1;
  const selBC = sel != null ? Math.floor(selC / 3) : -1;

  return (
    <div className="board">
      {board.map((v, i) => {
        const r = rowOf(i);
        const c = colOf(i);

        let highlight: CellHighlight = null;
        if (i === sel) highlight = "sel";
        else if (selVal && v === selVal) highlight = "same";
        else if (
          sel != null &&
          (r === selR || c === selC || (Math.floor(r / 3) === selBR && Math.floor(c / 3) === selBC))
        )
          highlight = "peer";

        let variant: CellVariant = null;
        if (v) {
          if (conflicts.has(i)) variant = "err";
          else if (given[i]) variant = "given";
          else if (hintSet.has(i)) variant = "hint";
          else variant = "user";
        }

        return (
          <Cell
            key={i}
            index={i}
            value={v}
            notes={notes[i] ?? []}
            variant={variant}
            highlight={highlight}
            borderRight={c % 3 === 2 && c !== 8}
            borderBottom={r % 3 === 2 && r !== 8}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
