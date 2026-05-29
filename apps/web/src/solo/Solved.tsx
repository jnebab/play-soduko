import { useMemo } from "react";
import { formatTime, type Difficulty } from "@sudoku/engine";
import { I, Svg } from "../icons.js";

export interface SolvedProps {
  time: number;
  mistakes: number;
  difficulty: Difficulty;
  onAgain: () => void;
  onHome: () => void;
}

const cap = (s: string): string => s[0]?.toUpperCase() + s.slice(1);

export function Solved({ time, mistakes, difficulty, onAgain, onHome }: SolvedProps) {
  const confetti = useMemo(() => {
    const cols = ["#E2603C", "#3E7C63", "#23261F", "#E9B949", "#C44A28"];
    return Array.from({ length: 24 }, (_, i) => ({
      left: Math.random() * 100,
      bg: cols[i % cols.length] as string,
      delay: Math.random() * 2.6,
      top: -Math.random() * 220,
    }));
  }, []);

  return (
    <div className="solved">
      <div className="confetti">
        {confetti.map((c, i) => (
          <i
            key={i}
            style={{ left: `${c.left}%`, background: c.bg, animationDelay: `${c.delay}s`, top: `${c.top}px` }}
          />
        ))}
      </div>
      <div className="trophy">
        <Svg d={I.trophy} w={40} />
      </div>
      <h2>Solved!</h2>
      <div className="ps">{cap(difficulty)} puzzle · nicely done</div>
      <div className="resultcard">
        <div className="c">
          <div className="k">Time</div>
          <div className="v">{formatTime(time)}</div>
        </div>
        <div className="c">
          <div className="k">Mistakes</div>
          <div className="v">{mistakes}</div>
        </div>
      </div>
      <button type="button" className="primary big" onClick={onAgain}>
        Play again
      </button>
      <button type="button" className="ghost" onClick={onHome}>
        New game
      </button>
    </div>
  );
}
