import { useState } from "react";
import { CLUE_TARGETS, DIFFICULTIES, type Difficulty } from "@sudoku/engine";
import { I, Svg } from "../icons.js";

const EST: Record<Difficulty, string> = {
  easy: "~5 min",
  medium: "~12 min",
  hard: "~20 min",
  expert: "~35 min",
};
const cap = (s: string): string => s[0]?.toUpperCase() + s.slice(1);

export type Mode = "solo" | "arena";

export interface HomeProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onStartSolo: (difficulty: Difficulty) => void;
  onQuickMatch: (difficulty: Difficulty) => void;
  onJoinRoom: (code: string) => void;
}

export function Home({ theme, onToggleTheme, onStartSolo, onQuickMatch, onJoinRoom }: HomeProps) {
  const [mode, setMode] = useState<Mode>("solo");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [code, setCode] = useState("");

  return (
    <div className="start">
      <button type="button" className="icon-btn theme-fab" onClick={onToggleTheme}>
        <Svg d={theme === "light" ? I.moon : I.sun} />
      </button>

      <div className="brand">
        <div className="mk">
          Sud<em>o</em>ku
        </div>
        <div className="sub">{mode === "arena" ? "arena · race the board" : "daily focus"}</div>
      </div>

      <div className="modes">
        <button
          type="button"
          className={"mode" + (mode === "solo" ? " active" : "")}
          onClick={() => setMode("solo")}
        >
          <Svg d={I.bolt} w={16} /> Solo
        </button>
        <button
          type="button"
          className={"mode" + (mode === "arena" ? " active" : "")}
          onClick={() => setMode("arena")}
        >
          <Svg d={I.users} w={16} /> Arena
        </button>
      </div>

      <div className="seg-label">Choose difficulty</div>
      {DIFFICULTIES.map((d, idx) => (
        <button
          key={d}
          type="button"
          className={"level" + (difficulty === d ? " active" : "")}
          onClick={() => setDifficulty(d)}
        >
          <div>
            <div className="name">{cap(d)}</div>
            <div className="meta">
              {EST[d]} · {CLUE_TARGETS[d]} clues
            </div>
          </div>
          <div className="meter">
            {[0, 1, 2, 3].map((m) => (
              <i key={m} className={m <= idx ? "f" : ""} />
            ))}
          </div>
        </button>
      ))}

      {mode === "solo" ? (
        <button type="button" className="primary big" onClick={() => onStartSolo(difficulty)}>
          Start {cap(difficulty)} <Svg d={I.arrow} />
        </button>
      ) : (
        <>
          <button type="button" className="primary big" onClick={() => onQuickMatch(difficulty)}>
            Quick match <Svg d={I.arrow} />
          </button>
          <div className="room-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ROOM CODE"
              aria-label="Room code"
            />
            <button
              type="button"
              className="primary"
              disabled={code.trim().length < 4}
              onClick={() => onJoinRoom(code.trim())}
            >
              Join
            </button>
          </div>
        </>
      )}
    </div>
  );
}
