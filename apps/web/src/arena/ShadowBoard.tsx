import { memo } from "react";
import { formatTime, type ShadowProgress } from "@sudoku/engine";

export interface ShadowBoardProps {
  progress: ShadowProgress;
  handle: string;
  rating?: number;
  online: boolean;
}

function ShadowBoardInner({ progress, handle, rating, online }: ShadowBoardProps) {
  const pct = Math.round((progress.filled / 81) * 100);
  return (
    <div className="opp">
      <div className="opp-head">
        <div className="who">
          <span className={"conn-dot" + (online ? "" : " down")} />
          {handle}
          {rating !== undefined && <small>{rating}</small>}
        </div>
        <div className="pct">{pct}%</div>
      </div>
      <div className="shadow" aria-label={`${handle} progress`}>
        {progress.cells.map((state, i) => (
          <div key={i} className={"sh " + state} />
        ))}
      </div>
      <div className="opp-meta">
        <span>{progress.filled}/81 filled</span>
        <span>{progress.mistakes} mistakes</span>
        <span>{formatTime(Math.floor(progress.elapsedMs / 1000))}</span>
      </div>
    </div>
  );
}

export const ShadowBoard = memo(ShadowBoardInner);
