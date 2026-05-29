import { useCallback, useState } from "react";
import type { Difficulty } from "@sudoku/engine";
import { Home } from "./ui/Home.js";
import { SoloGame } from "./solo/SoloGame.js";
import { ArenaGame, type ArenaIntent } from "./arena/ArenaGame.js";

type Theme = "light" | "dark";

type Route =
  | { view: "home" }
  | { view: "solo"; difficulty: Difficulty; nonce: number }
  | { view: "arena"; intent: ArenaIntent };

export function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [route, setRoute] = useState<Route>({ view: "home" });

  const toggleTheme = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);
  const goHome = useCallback(() => setRoute({ view: "home" }), []);

  const wide = route.view === "arena";

  return (
    <div className="root" data-theme={theme}>
      <div className={"app" + (wide ? " wide" : "")}>
        {route.view === "home" && (
          <Home
            theme={theme}
            onToggleTheme={toggleTheme}
            onStartSolo={(difficulty) => setRoute({ view: "solo", difficulty, nonce: 0 })}
            onQuickMatch={(difficulty) =>
              setRoute({ view: "arena", intent: { kind: "queue", difficulty } })
            }
            onJoinRoom={(code) => setRoute({ view: "arena", intent: { kind: "room", code } })}
          />
        )}

        {route.view === "solo" && (
          <SoloGame
            key={`${route.difficulty}-${route.nonce}`}
            difficulty={route.difficulty}
            theme={theme}
            onToggleTheme={toggleTheme}
            onExit={goHome}
            onPlayAgain={() =>
              setRoute({ view: "solo", difficulty: route.difficulty, nonce: route.nonce + 1 })
            }
          />
        )}

        {route.view === "arena" && (
          <ArenaGame intent={route.intent} theme={theme} onToggleTheme={toggleTheme} onExit={goHome} />
        )}
      </div>
    </div>
  );
}
