import { formatTime, type Difficulty } from "@sudoku/engine";
import { I, Svg } from "../icons.js";
import { Board } from "../ui/Board.js";
import { Controls } from "../ui/Controls.js";
import { NumberPad } from "../ui/NumberPad.js";
import { useSoloGame } from "./useSoloGame.js";
import { Solved } from "./Solved.js";

const cap = (s: string): string => s[0]?.toUpperCase() + s.slice(1);

export interface SoloGameProps {
  difficulty: Difficulty;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onExit: () => void;
  /** restart with a fresh puzzle of the same difficulty */
  onPlayAgain: () => void;
}

export function SoloGame({ difficulty, theme, onToggleTheme, onExit, onPlayAgain }: SoloGameProps) {
  const g = useSoloGame(difficulty);

  if (g.state.status === "solved") {
    return (
      <Solved
        time={g.time}
        mistakes={g.state.mistakes}
        difficulty={difficulty}
        onAgain={onPlayAgain}
        onHome={onExit}
      />
    );
  }

  return (
    <>
      <header className="ghead">
        <button type="button" className="icon-btn" onClick={onExit}>
          <Svg d={I.back} />
        </button>
        <div className="gtitle">{cap(difficulty)}</div>
        <div className="hgroup">
          <button type="button" className="icon-btn" onClick={onToggleTheme}>
            <Svg d={theme === "light" ? I.moon : I.sun} />
          </button>
          <button type="button" className="icon-btn" onClick={() => g.setPaused(true)}>
            <Svg d={I.pause} />
          </button>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="k">Mistakes</div>
          <div className={"v" + (g.state.mistakes ? " warn" : "")}>{g.state.mistakes}</div>
        </div>
        <div className="stat">
          <div className="k">Hints</div>
          <div className="v acc">{g.state.hintsLeft}</div>
        </div>
        <div className="stat">
          <div className="k">Time</div>
          <div className="v">{formatTime(g.time)}</div>
        </div>
      </div>

      <div className="board-pad">
        <Board
          board={g.state.board}
          notes={g.state.notes}
          given={g.state.given}
          hintSet={g.state.hintSet}
          conflicts={g.conflicts}
          sel={g.state.sel}
          onSelect={g.select}
        />

        {g.paused && (
          <div className="overlay">
            <div className="ov-card">
              <div className="ov-time">{formatTime(g.time)}</div>
              <div className="ov-sub">Paused</div>
              <button type="button" className="primary" onClick={() => g.setPaused(false)}>
                <Svg d={I.play} /> Resume
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tools">
        <Controls
          notesMode={g.state.notesMode}
          canUndo={g.state.history.length > 0}
          hintsLeft={g.state.hintsLeft}
          onUndo={g.undo}
          onErase={g.erase}
          onToggleNotes={g.toggleNotes}
          onHint={g.hint}
        />
        <NumberPad remaining={g.remaining} notesMode={g.state.notesMode} onPick={g.place} />
      </div>
    </>
  );
}
