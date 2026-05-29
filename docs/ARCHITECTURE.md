# Architecture

Realtime competitive Sudoku. N players solve **one identical puzzle** on a synchronized timer; everyone watches everyone fill in live, but **no one sees an opponent's digits**. The server is the single source of truth for state, time, and the win.

## System topology
```mermaid
flowchart TB
  subgraph Clients
    A[Player A<br/>React client]
    B[Player B<br/>React client]
    V[Spectators ×N<br/>read-only]
  end
  GW["WebSocket Gateways ×N<br/>stateless · auth · rate-limit · heartbeat"]
  MM["Matchmaking<br/>queue · room codes · ELO buckets"]
  R[("Redis<br/>pub/sub fan-out · presence<br/>ephemeral match state · queue")]
  AU["Game Authority (match owner)<br/>holds solution · validates moves<br/>owns timer · detects winner"]
  PG[("PostgreSQL<br/>users · matches · results · puzzles")]
  W["Puzzle Worker (ARQ)<br/>pre-generates unique pool"]

  A -->|WSS moves| GW
  B -->|WSS moves| GW
  V -->|WSS read-only| GW
  GW <-->|subscribe / publish| R
  R <-->|moves in / sanitized events out| AU
  MM --> R
  MM -->|spawn match| AU
  AU <-->|read puzzle / write results| PG
  W -->|store pool| PG
```
Stateless gateways scale horizontally; Redis fans messages across them. Each match is **homed on one authority owner** (consistent hash of `matchId`) so validation and win-detection are serialized — no race on "who finished first." Postgres holds only durable data; live state is Redis/in-memory.

## The core trick — privacy-preserving progress
```mermaid
flowchart LR
  M["placeMove { cell, value }<br/>(carries the real digit)"] --> S{"Authority<br/>validate vs solution"}
  S -->|private, to the mover| ACK["moveAck { cell, ok }<br/>+ your timer"]
  S -->|public, to everyone else| SH["shadowGrid<br/>states only:<br/>given | filled | wrong | empty<br/><b>NO digits</b>"]
```
The board fills in for spectators like a progress bar they can't copy from. Fidelity is tunable: full shadow grid for drama, or just `%complete` for a ranked/anti-leak mode (same event, less verbosity). Spectator updates are **coalesced to ~3/sec per player** to bound fan-out bandwidth.

## Move flow & authoritative timing
```mermaid
sequenceDiagram
  participant C as Client
  participant G as Gateway
  participant A as Authority
  C->>C: tap cell + number (optimistic render)
  C->>G: placeMove{cell,value}
  G->>A: forward on match channel
  A->>A: validate vs held solution · stamp serverTs
  A-->>C: moveAck{cell, ok}  (reconcile / rollback)
  A-->>G: opponentProgress{shadowGrid, counters}
  G-->>C: fan-out sanitized event to others
  A->>A: if board complete & correct → freeze finish = serverTs
```
**Timer:** match carries a server `startTs` sent at the synchronized `3·2·1·GO` reveal. Clients render a smooth local clock from `now − startTs`, but official elapsed = `serverReceiveTs(winningMove) − startTs`.

## Match lifecycle (mirrored: XState front, server state back)
```mermaid
stateDiagram-v2
  [*] --> Queue
  Queue --> Countdown: match found
  Countdown --> Playing: GO (broadcast startTs)
  Playing --> Finished: first correct completion
  Finished --> [*]
  Playing --> Playing: reconnect → stateSnapshot
```
On reconnect (common on mobile) the server replays a `stateSnapshot`: your board, opponents' shadow grids, and elapsed. Heartbeat ping/pong; grace window before forfeit.

## Integrity & anti-cheat
- **Solution never ships** — clients get givens only; correctness is a server reply.
- **Server-owned time** — finish stamped on receipt of the completing move.
- **Every move validated** — no client-claimed completion; full board re-checked.
- **Anomaly guard** — per-connection move rate-limit; flag superhuman solve curves.
- **Spectators are read-only** — inbound moves on spectator sockets are rejected.

## Puzzle generation (Python, server-only)
1. Fill an empty grid via randomized backtracking → a complete valid solution.
2. Dig cells in random order; after each removal, **count solutions (stop at 2)**; keep the removal only if the solution stays **unique**.
3. Stop at the difficulty's target clue count: `easy 43 · medium 34 · hard 30 · expert 27`.
4. Worker pre-generates a **pool** into Postgres so match start is instant (no gen latency at GO).

## Scale path
- **MVP** — single FastAPI process: WS endpoints + in-memory match state + asyncio timer loop; Redis optional. Fine for hundreds of concurrent matches.
- **Scaled** — stateless WS gateways behind a load balancer; matches sharded across authority owners by consistent hash; Redis pub/sub fan-out; very large spectator audiences served through an edge/CDN read-fan tier with coalesced ticks. The wire protocol is identical at both stages.
