import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import {
  emptyBoard,
  emptyNotes,
  findConflicts,
  peersOf,
  remainingDigits,
  type Board,
  type Notes,
  type ServerMsg,
  type ShadowProgress,
} from "@sudoku/engine";
import { WS_URL } from "../config.js";
import { arenaMachine } from "./arenaMachine.js";
import { getIdentity } from "./identity.js";
import { WsClient, type ConnectionState } from "./wsClient.js";

export type ArenaIntent =
  | { kind: "queue"; difficulty: import("@sudoku/engine").Difficulty }
  | { kind: "room"; code: string };

interface BoardState {
  board: Board;
  given: boolean[];
  notes: Notes;
  /** cells the server has told us are wrong (moveAck.ok === false) */
  wrong: Set<number>;
  mistakes: number;
}

const freshBoard = (): BoardState => ({
  board: emptyBoard(),
  given: new Array<boolean>(81).fill(false),
  notes: emptyNotes(),
  wrong: new Set<number>(),
  mistakes: 0,
});

export function useArena(intent: ArenaIntent) {
  const identity = useMemo(getIdentity, []);
  const [snapshot, send] = useMachine(arenaMachine);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const [bs, setBs] = useState<BoardState>(freshBoard);
  const [sel, setSel] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [opponents, setOpponents] = useState<Map<string, ShadowProgress>>(new Map());
  const [serverOffset, setServerOffset] = useState(0);

  const clientRef = useRef<WsClient | null>(null);
  const startedRef = useRef(false);

  const handleMessage = useCallback(
    (msg: ServerMsg) => {
      switch (msg.t) {
        case "matchFound":
          send({
            type: "MATCH_FOUND",
            matchId: msg.matchId,
            players: msg.players,
            difficulty: msg.difficulty,
          });
          break;
        case "countdown":
          send({ type: "COUNTDOWN", secondsLeft: msg.secondsLeft });
          break;
        case "matchStart": {
          const given = msg.givens.map((v) => v !== 0);
          setBs({
            board: msg.givens.slice(),
            given,
            notes: emptyNotes(),
            wrong: new Set<number>(),
            mistakes: 0,
          });
          send({ type: "MATCH_START", startTs: msg.startTs, players: msg.players });
          break;
        }
        case "moveAck":
          setBs((prev) => {
            const wrong = new Set(prev.wrong);
            let mistakes = prev.mistakes;
            if (msg.ok) {
              wrong.delete(msg.cell);
            } else if (!wrong.has(msg.cell)) {
              wrong.add(msg.cell);
              mistakes += 1;
            }
            return { ...prev, wrong, mistakes };
          });
          break;
        case "opponentProgress":
          setOpponents((prev) => {
            const next = new Map(prev);
            next.set(msg.progress.playerId, msg.progress);
            return next;
          });
          break;
        case "stateSnapshot": {
          setBs((prev) => ({
            ...prev,
            board: msg.you.cells.slice(),
            notes: msg.you.notes.map((n) => n.slice()),
          }));
          setOpponents(() => {
            const next = new Map<string, ShadowProgress>();
            for (const o of msg.opponents) next.set(o.playerId, o);
            return next;
          });
          setServerOffset(msg.serverNow - Date.now());
          break;
        }
        case "matchOver":
          send({ type: "MATCH_OVER", results: msg.results });
          break;
        case "error":
          send({ type: "SERVER_ERROR", code: msg.code, message: msg.message });
          break;
        case "pong":
          break;
      }
    },
    [send],
  );

  // open the socket once, send the join intent on connect
  useEffect(() => {
    const params = new URLSearchParams({ id: identity.id, handle: identity.handle });
    const client = new WsClient({
      url: `${WS_URL}/ws?${params.toString()}`,
      onMessage: handleMessage,
      onStateChange: (state) => {
        setConn(state);
        if (state === "open") {
          // (re)announce intent — server is idempotent on rejoin
          if (intent.kind === "queue") client.send({ t: "joinQueue", difficulty: intent.difficulty });
          else client.send({ t: "joinRoom", code: intent.code });
          if (!startedRef.current) {
            send({ type: "CONNECTED" });
            startedRef.current = true;
          }
        }
      },
    });
    clientRef.current = client;
    client.connect();
    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = useCallback((i: number) => bs.given[i] === true, [bs.given]);

  const place = useCallback(
    (digit: number) => {
      const client = clientRef.current;
      if (sel == null || client == null) return;
      if (snapshot.value !== "playing") return;
      if (locked(sel)) return;

      if (notesMode && bs.board[sel] === 0) {
        setBs((prev) => {
          const notes = prev.notes.map((n) => n.slice());
          const arr = notes[sel] ?? [];
          const k = arr.indexOf(digit);
          if (k >= 0) arr.splice(k, 1);
          else {
            arr.push(digit);
            arr.sort((x, y) => x - y);
          }
          notes[sel] = arr;
          return { ...prev, notes };
        });
        client.send({ t: "noteMove", cell: sel, value: digit });
        return;
      }

      if (bs.board[sel] === digit) {
        // tapping the same number clears it
        setBs((prev) => {
          const board = prev.board.slice();
          board[sel] = 0;
          const wrong = new Set(prev.wrong);
          wrong.delete(sel);
          return { ...prev, board, wrong };
        });
        client.send({ t: "eraseMove", cell: sel });
        return;
      }

      // optimistic place; server reconciles via moveAck
      setBs((prev) => {
        const board = prev.board.slice();
        const notes = prev.notes.map((n) => n.slice());
        board[sel] = digit;
        notes[sel] = [];
        for (const p of peersOf(sel)) {
          const pn = notes[p] ?? [];
          const k = pn.indexOf(digit);
          if (k >= 0) pn.splice(k, 1);
        }
        const wrong = new Set(prev.wrong);
        wrong.delete(sel);
        return { ...prev, board, notes, wrong };
      });
      client.send({ t: "placeMove", cell: sel, value: digit });
    },
    [sel, snapshot.value, notesMode, bs.board, locked],
  );

  const erase = useCallback(() => {
    const client = clientRef.current;
    if (sel == null || client == null || locked(sel)) return;
    if (bs.board[sel] === 0 && (bs.notes[sel]?.length ?? 0) === 0) return;
    setBs((prev) => {
      const board = prev.board.slice();
      const notes = prev.notes.map((n) => n.slice());
      board[sel] = 0;
      notes[sel] = [];
      const wrong = new Set(prev.wrong);
      wrong.delete(sel);
      return { ...prev, board, notes, wrong };
    });
    client.send({ t: "eraseMove", cell: sel });
  }, [sel, bs.board, bs.notes, locked]);

  const ready = useCallback(() => clientRef.current?.send({ t: "ready" }), []);

  // combine local duplicate-conflicts (for feel) with server-confirmed wrongs
  const conflicts = useMemo(() => {
    const c = findConflicts(bs.board);
    for (const w of bs.wrong) c.add(w);
    return c;
  }, [bs.board, bs.wrong]);

  const remaining = useMemo(() => remainingDigits(bs.board), [bs.board]);
  const filled = useMemo(() => bs.board.filter((v) => v !== 0).length, [bs.board]);

  return {
    identity,
    phase: snapshot.value as string,
    context: snapshot.context,
    conn,
    board: bs.board,
    given: bs.given,
    notes: bs.notes,
    mistakes: bs.mistakes,
    filled,
    sel,
    notesMode,
    conflicts,
    remaining,
    opponents: useMemo(
      () => [...opponents.values()].filter((o) => o.playerId !== identity.id),
      [opponents, identity.id],
    ),
    serverOffset,
    select: setSel,
    place,
    erase,
    toggleNotes: useCallback(() => setNotesMode((m) => !m), []),
    ready,
  };
}
