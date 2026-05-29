import { formatTime, type MatchResult, type PlayerPublic } from "@sudoku/engine";
import { I, Svg } from "../icons.js";

export interface ArenaResultsProps {
  results: MatchResult[];
  players: PlayerPublic[];
  youId: string;
  onExit: () => void;
}

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
};

export function ArenaResults({ results, players, youId, onExit }: ArenaResultsProps) {
  const handleOf = (id: string): string => players.find((p) => p.id === id)?.handle ?? "Player";
  const sorted = [...results].sort((a, b) => a.placement - b.placement);
  const you = results.find((r) => r.playerId === youId);
  const won = you?.placement === 1;

  return (
    <div className="solved">
      <div className={"trophy" + (won ? "" : " lose")}>
        <Svg d={I.trophy} w={40} />
      </div>
      <h2>{won ? "You won!" : you ? `${ordinal(you.placement)} place` : "Match over"}</h2>
      <div className="ps">
        {you?.finishMs != null
          ? `Finished in ${formatTime(Math.floor(you.finishMs / 1000))}`
          : "Better luck next race"}
      </div>

      <div className="results">
        {sorted.map((r) => (
          <div key={r.playerId} className={"result-row" + (r.playerId === youId ? " you" : "")}>
            <span className="place">{r.placement}</span>
            <span className="rname">{handleOf(r.playerId)}</span>
            <span className="rtime">
              {r.finishMs != null ? formatTime(Math.floor(r.finishMs / 1000)) : "—"}
            </span>
            <span className={"rdelta " + (r.ratingDelta >= 0 ? "up" : "down")}>
              {r.ratingDelta >= 0 ? "+" : ""}
              {r.ratingDelta}
            </span>
          </div>
        ))}
      </div>

      <button type="button" className="primary big" onClick={onExit}>
        Back to menu
      </button>
    </div>
  );
}
