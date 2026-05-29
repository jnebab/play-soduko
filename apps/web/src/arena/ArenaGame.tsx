import { useEffect, useState } from "react";
import { formatTime, type ShadowProgress } from "@sudoku/engine";
import { I, Svg } from "../icons.js";
import { Board } from "../ui/Board.js";
import { Controls } from "../ui/Controls.js";
import { NumberPad } from "../ui/NumberPad.js";
import { ArenaResults } from "./ArenaResults.js";
import { ShadowBoard } from "./ShadowBoard.js";
import { useArena, type ArenaIntent } from "./useArena.js";

export type { ArenaIntent };

export interface ArenaGameProps {
  intent: ArenaIntent;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onExit: () => void;
}

/** Re-renders on an interval so the live clock ticks. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function ArenaGame({ intent, theme, onToggleTheme, onExit }: ArenaGameProps) {
  const a = useArena(intent);
  const playing = a.phase === "playing";
  const now = useNow(playing);

  const startTs = a.context.startTs;
  const elapsedMs = playing && startTs != null ? Math.max(0, now + a.serverOffset - startTs) : 0;

  if (a.phase === "failed") {
    return (
      <div className="lobby">
        <h2>Couldn’t start</h2>
        <p>{a.context.error ?? "Connection error"}</p>
        <button type="button" className="primary" onClick={onExit}>
          Back to menu
        </button>
      </div>
    );
  }

  if (a.phase === "finished") {
    return (
      <ArenaResults
        results={a.context.results}
        players={a.context.players}
        youId={a.identity.id}
        onExit={onExit}
      />
    );
  }

  if (a.phase === "connecting" || a.phase === "queue") {
    return (
      <div className="lobby">
        <div className="spinner" />
        <h2>{intent.kind === "room" ? "Joining room" : "Finding a match"}</h2>
        <p>
          {a.conn === "open"
            ? "Waiting for another player…"
            : a.conn === "connecting"
              ? "Connecting…"
              : "Reconnecting…"}
        </p>
        {intent.kind === "room" && <div className="code-chip">{intent.code}</div>}
        <button type="button" className="ghost" onClick={onExit} style={{ maxWidth: 200 }}>
          Cancel
        </button>
      </div>
    );
  }

  // countdown or playing → show the board
  return (
    <div className="arena">
      <header className="ghead">
        <button type="button" className="icon-btn" onClick={onExit}>
          <Svg d={I.back} />
        </button>
        <div className="gtitle">Arena{a.context.difficulty ? ` · ${a.context.difficulty}` : ""}</div>
        <div className="hgroup">
          <button type="button" className="icon-btn" onClick={onToggleTheme}>
            <Svg d={theme === "light" ? I.moon : I.sun} />
          </button>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="k">Mistakes</div>
          <div className={"v" + (a.mistakes ? " warn" : "")}>{a.mistakes}</div>
        </div>
        <div className="stat">
          <div className="k">Filled</div>
          <div className="v acc">{a.filled}/81</div>
        </div>
        <div className="stat">
          <div className="k">Time</div>
          <div className="v">{formatTime(Math.floor(elapsedMs / 1000))}</div>
        </div>
      </div>

      <div className="arena-body">
        <div className="board-pad">
          <Board
            board={a.board}
            notes={a.notes}
            given={a.given}
            hintSet={EMPTY_SET}
            conflicts={a.conflicts}
            sel={a.sel}
            onSelect={a.select}
          />
          {a.phase === "countdown" && (
            <div className="overlay">
              <div className="ov-card">
                <div className="count-num">
                  {a.context.secondsLeft > 0 ? a.context.secondsLeft : "GO"}
                </div>
                <div className="ov-sub">Get ready</div>
              </div>
            </div>
          )}
        </div>

        <div className="opp-panels">
          {a.opponents.length === 0 && (
            <div className="opp">
              <div className="opp-meta">
                <span>Waiting for opponent progress…</span>
              </div>
            </div>
          )}
          {a.opponents.map((o: ShadowProgress) => {
            const p = a.context.players.find((pl) => pl.id === o.playerId);
            return (
              <ShadowBoard
                key={o.playerId}
                progress={o}
                handle={p?.handle ?? "Opponent"}
                rating={p?.rating}
                online
              />
            );
          })}
        </div>
      </div>

      <div className="tools">
        <Controls
          notesMode={a.notesMode}
          canUndo={false}
          onUndo={NOOP}
          onErase={a.erase}
          onToggleNotes={a.toggleNotes}
        />
        <NumberPad remaining={a.remaining} notesMode={a.notesMode} onPick={a.place} />
      </div>
    </div>
  );
}

const EMPTY_SET = new Set<number>();
const NOOP = (): void => {};
