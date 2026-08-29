# Pong Arena — Step-by-step TODO

Goal: a public Pong arcade cabinet on the web. One room. A game session runs
on the server; everyone who opens the page watches it and chats. Press Play to
take a seat (or queue for one). No accounts, no database, nothing stored.

Inspired by 42's ft_transcendence (old subject: chat, matchmaking, spectate,
live games) with auth and persistence deliberately removed.

Key React lesson of this project: **state that changes 60×/second
(ball position) does NOT go in `useState`** — it goes in a `useRef`.
`useState` re-renders React on every change; a game loop redraws the
canvas itself. Score, pause, winner → `useState` (React UI).
Ball/paddle positions → `useRef` (game data).

Key architecture lesson of Part B onward: **the server owns the game.**
The browser only sends inputs and draws whatever state it receives.

---

## Decisions log (change here, not in your head)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Identity | No login. Random `playerToken` in localStorage = identity. `name` = display label, 1–16 chars, unique in room (auto-suffix `bob_2`). |
| 2 | Persistence | None. Everything lives in server memory. Restart = clean slate. |
| 3 | Rooms | One public room. (Private rooms via URL = maybe later, same code path.) |
| 4 | Seats | 2 seats. Each is `ai` or a `human` (by token). |
| 5 | Sessions are atomic | Nobody is swapped mid-session. Newcomers queue until it ends. |
| 6 | Session end | Winner stays. AI seats, then the loser's seat, are filled from the queue. |
| 7 | Human leaves mid-game | Session → `PAUSED`. Remaining human picks: wait / continue vs AI / quit. 30 s timeout → continue vs AI. Both gone → session ends. |
| 8 | Idle | No session runs when nobody wants to play. "AI vs AI" button starts an exhibition; any Play press ends it. |
| 9 | Stats / history / ladder | Not now. `SESSION_FINISHED` event is the hook for later. |
| 10 | Hosting | Custom Node server (Next + `ws`, one port) in Docker. Not Vercel. |

---

# Part A — Local Pong (browser only)

## Step 1 — A page that shows your canvas

**Requirements**
- [x] Create a Pong page (e.g. `app/pong/page.jsx`) that renders your `Canvas` component
- [x] Give the canvas a fixed size, e.g. `width={800} height={500}`
- [x] Draw a background filling the whole canvas to prove it works (went white + border instead of black)

**Hints**
- Your existing `draw(ctx)` is the right idea — start by making it
  `ctx.fillRect(0, 0, canvas.width, canvas.height)`
- Careful: CSS size and canvas `width`/`height` attributes are different
  things. Set the attributes, not (only) CSS, or drawings get stretched.

---

## Step 2 — Draw the game objects (static first)

**Requirements**
- [x] Define the game state as one plain object: ball + two paddles
- [x] Write small draw functions: `drawBall`, `drawPaddle`, `drawNet` (dashed center line)
- [x] Draw everything once, no movement yet

**What to create**
```js
// initial game state — lives in a useRef, NOT useState
const state = {
  ball:    { x: 400, y: 250, r: 8, vx: 4, vy: 3 },   // v = velocity per frame
  left:    { x: 10,  y: 210, w: 12, h: 80 },
  right:   { x: 778, y: 210, w: 12, h: 80 },
}
```

**Hints**
- One function per drawable thing keeps it clean:
  `drawBall(ctx, ball)`, `drawPaddle(ctx, paddle)`
- `ctx.setLineDash([10, 10])` for the net

---

## Step 3 — The game loop (the big React lesson)

**Requirements**
- [x] Start a `requestAnimationFrame` loop inside a `useEffect`
- [x] Each frame: update positions → clear canvas → redraw everything
- [x] Clean the loop up when the component unmounts (return a cleanup function!)

**Pseudocode**
```js
useEffect(() => {
  const ctx = canvasRef.current.getContext('2d')
  let frameId

  const loop = () => {
    update(stateRef.current)        // move things
    render(ctx, stateRef.current)   // clear + draw everything
    frameId = requestAnimationFrame(loop)
  }
  frameId = requestAnimationFrame(loop)

  return () => cancelAnimationFrame(frameId)   // cleanup on unmount
}, [])
```

**Hints**
- `update` for now: `ball.x += ball.vx; ball.y += ball.vy`
- "Clear" = redraw the background rect first each frame
- Test: the ball should fly off the screen. That's success for this step!
- If the ball moves twice as fast as expected: React StrictMode mounts
  effects twice in dev — that's why the cleanup function matters.

---

## Step 4 — Ball bounces off top and bottom

**Requirements**
- [x] When the ball's edge (not center — remember the radius) touches the top or bottom, invert `vy`

**code**
```
		const update = (ctx: CanvasRenderingContext2D, game: GameState) => {
			//move things here
			const ball = game.ball;

			ball.x += ball.vx;
			ball.y += ball.vy;

			if (ball.y - ball.r <= 0 || ball.y + ball.r >= ctx.canvas.height) {
				ball.vy = -ball.vy;
			}
			if (ball.x - ball.r <= 0 || ball.x + ball.r >= ctx.canvas.width) {
				ball.vx = -ball.vx;
			}
		};
```

---

## Step 5 — Keyboard-controlled paddle

**Requirements**
- [x] Player paddle follows keys: W/S (or ArrowUp/ArrowDown) (did both — W/S left paddle, arrows right paddle)
- [x] Listen with a `keydown`/`keyup` effect on `window` — and remove the listeners in cleanup (`KeyboardInput` class in `components/movement.ts`, `destroy()` called in effect cleanup)
- [x] Movement should be smooth: track *which keys are held* in a ref, and move the paddle inside the game loop (don't move it directly in the event handler)
- [x] Clamp the paddle so it can't leave the canvas (`movePaddle()` helper)

**Pseudocode**
```js
// keys ref: { w: false, s: false }
useEffect(() => {
  const down = (e) => { keysRef.current[e.key] = true }
  const up   = (e) => { keysRef.current[e.key] = false }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  return () => { /* removeEventListener both */ }
}, [])

// inside update():
// if keys.w held → paddle.y -= PADDLE_SPEED
// if keys.s held → paddle.y += PADDLE_SPEED
// clamp: paddle.y = max(0, min(canvas.height - paddle.h, paddle.y))
```

---

## Step 6 — Ball bounces off paddles

**Requirements**
- [x] Detect ball–paddle overlap (rectangle vs circle; treating the ball as a small square is fine) (`hit()` in `page.tsx`, module level)
- [x] On hit: invert `vx` (`manageBallBounces()`; left/right wall bounce removed — missed ball flies off, ready for step 7)
- [ ] Nicer bounce (optional): the further from the paddle's center the ball hits, the steeper the angle → set `vy` based on `(ball.y - paddleCenter) / (paddle.h / 2)`

**Pseudocode**
```
hit(ball, paddle):
    return ball.x - ball.r < paddle.x + paddle.w
       AND ball.x + ball.r > paddle.x
       AND ball.y - ball.r < paddle.y + paddle.h
       AND ball.y + ball.r > paddle.y
```

**Hint**
- Bug to expect: the ball can get "stuck" inside a paddle, flipping `vx`
  every frame. Fix: after a hit, also push the ball outside the paddle,
  or only flip when it's moving *toward* the paddle.

---

## Step 7 — Scoring (this is where useState finally appears)

**Requirements**
- [x] When the ball exits left → right player scores; exits right → left player scores (`checkScore()` returns `"left" | "right" | null`, called after `manageBallBounces()`)
- [x] Score lives in `useState` and is rendered as JSX (a `<div>` above the canvas — no need to draw text on canvas) (rendered inside `Canvas`, above the `<canvas>`; loop writes via `setScore(s => ...)`, never reads `score`)
- [x] After a point: reset ball to center, send it toward whoever just conceded (`resetBall(ball, w, h, direction)`, -1 = toward left, 1 = toward right)

**Hints**
- The game loop can't read fresh `useState` values (stale closure!) —
  but it doesn't need to: call `setScore(s => ({...s, left: s.left + 1}))`
  with the updater-function form and you never read the old value.
- This is the moment you really *feel* the ref/state split. Worth pausing
  on: why can the loop write state but not read it?

---

## Step 8 — Simple AI opponent

**Requirements**
- [ ] Each frame, the right paddle moves toward the ball's y position
- [ ] Cap its speed (slower than the ball!) so it's beatable
- [ ] Add a deadzone so it doesn't jitter when centered on the ball

**Pseudocode**
```
center = paddle.y + paddle.h / 2
if center < ball.y - DEADZONE: paddle.y += AI_SPEED
if center > ball.y + DEADZONE: paddle.y -= AI_SPEED
```

**Hint**
- Write it as a pure function `aiInput(ball, paddle): "up" | "down" | null`.
  It returns an *input*, not a paddle move — then it goes through the same
  `movePaddle()` a human does. This matters in Part B: the server treats
  AI and humans identically, only the source of the input differs.

---

## Step 9 — Game flow & polish (local)

**Requirements**
- [x] Pause/resume with Space or a button (`useState` boolean; when paused, skip `update()` but keep rendering) (Escape; `isPausedRef` for the loop, `isPaused` state for the JSX, rising-edge toggle)
- [ ] Win condition: first to 5 → show a "X wins — play again?" overlay in JSX
- [ ] Restart button that resets score (state) *and* positions (ref)

**Ideas if you want more**
- Speed the ball up slightly on every paddle hit
- Sounds with the `Audio` API on bounce/score

---

# Part B — Make the game pure (server-ready refactor)

Everything below depends on this. Right now the game logic is tangled with
the canvas (`ctx.canvas.width`) and lives in a React file. The server has no
canvas and no React. Goal: a folder of plain TypeScript the server can import.

## Step 10 — Extract `lib/pong/`

**Requirements**
- [ ] Create `lib/pong/types.ts` — move `Ball`, `Paddle`, `GameState` here. Add `width` and `height` to `GameState` (the field, not the canvas)
- [ ] Create `lib/pong/constants.ts` — move all `PADDLE_*`, `BALL_*`, add `WIN_SCORE = 5`, `AI_SPEED`, `AI_DEADZONE`
- [ ] Create `lib/pong/logic.ts` — move `hit`, `movePaddle`, `manageBallBounces`, `checkScore`, `resetBall`, `aiInput`. **Zero** references to `ctx`, `canvas`, `window`, `document`, React. Use `state.width` / `state.height` instead
- [ ] Add `createGameState(width, height): GameState` — the initial object, now a function
- [ ] Add one entry point: `step(state: GameState, inputs: Inputs): StepResult`
- [ ] `page.tsx` keeps only: refs, effects, `draw*` functions, JSX. It imports from `lib/pong/`
- [ ] Game plays exactly as before. This step changes no behavior

**What to create**
```ts
// lib/pong/types.ts
type PaddleInput = "up" | "down" | null;
interface Inputs { left: PaddleInput; right: PaddleInput; }
interface StepResult { scorer: "left" | "right" | null; }

// lib/pong/logic.ts
function step(state: GameState, inputs: Inputs): StepResult {
	// movePaddle both sides from inputs
	// move ball, manageBallBounces
	// checkScore → resetBall if someone scored
	// return { scorer }
}
```

**Hints**
- `step()` mutates `state` in place and returns what happened. The caller
  (browser today, server tomorrow) decides what to do with `scorer`.
- Score itself: put `score: { left: number; right: number }` INTO `GameState`.
  In the browser you mirror it into `useState` after `step()` returns a scorer.
  On the server there is no React, so state is the only truth.
- Test: `npx tsc --noEmit` clean, game identical, and `grep -r "ctx\|window" lib/pong/` returns nothing.

---

## Step 11 — Unit test the pure logic (optional, but now it's free)

**Requirements**
- [ ] Install a test runner (`vitest` is the least setup)
- [ ] `hit()`: overlapping → true, ball just past paddle edge → false
- [ ] `step()`: ball at `x = -20` → `scorer === "right"` and ball back at center
- [ ] `movePaddle()`: never leaves `[0, height - h]`

**Hint**
- This is the payoff of "no React in `lib/`": tests run in Node, no browser,
  no mocking. Each test is 3 lines.

---

# Part C — Realtime foundation (server + socket)

## Step 12 — Custom server: Next + WebSocket on one port

**Requirements**
- [ ] Read `node_modules/next/dist/docs/01-app/02-guides/custom-server.md` — this Next version differs from your training data
- [ ] Create `server.ts` at the repo root: `createServer` → `next({ dev })` handles HTTP, `ws` (`npm i ws @types/ws`) attaches to the same `http.Server`
- [ ] `package.json` scripts: `"dev": "tsx server.ts"` (or `node --experimental-strip-types`), `"start": "NODE_ENV=production tsx server.ts"`
- [ ] Log every connection/disconnection to the console
- [ ] Browser: a `useEffect` opens `new WebSocket(...)`, logs `open`/`close`. Cleanup closes it

**Pseudocode**
```ts
// server.ts
const httpServer = createServer((req, res) => handle(req, res));
const wss = new WebSocketServer({ server: httpServer });
wss.on("connection", (socket) => {
	console.log("client connected");
	socket.on("message", (raw) => { /* JSON.parse, dispatch */ });
	socket.on("close",   () => { /* remove player */ });
});
httpServer.listen(port);
```

**Hints**
- Route Handlers (`app/api/.../route.ts`) can NOT do WebSockets in Next —
  the doc says so. That's why the custom server exists.
- `server.ts` is not compiled by Next. It must import `lib/pong/*` with paths
  Node understands — no `@/` alias unless you configure it for `tsx` too.
- One `.env` var: `PORT`. Nothing secret exists in this project yet.
- StrictMode will open/close the socket twice in dev. If your cleanup closes
  it, that's correct behavior, not a bug.

---

## Step 13 — Identity without accounts

**Requirements**
- [ ] Browser: on first load, if `localStorage.playerToken` is missing, generate one (`crypto.randomUUID()`) and store it
- [ ] Browser: ask for a name once (simple `<input>` + button), store in `localStorage.name`
- [ ] First message on connect: `{ type: "hello", token, name }`
- [ ] Server: `Map<token, Player>` where `Player = { token, name, socket }`. Same token reconnecting **replaces** the old socket — that's your reconnect
- [ ] Server: validate name — trim, 1–16 chars, `[A-Za-z0-9_-]`, unique among connected players (else suffix `_2`, `_3`). Reply `{ type: "welcome", name }` with the name actually assigned
- [ ] Server: on socket `close`, remove the player after a 10 s grace period (so a refresh doesn't flicker "left / joined")

**Message shapes**
```ts
// client → server
{ type: "hello", token: string, name: string }
// server → client
{ type: "welcome", name: string }
{ type: "presence", players: { name: string }[] }
```

**Hints**
- The server never trusts the name for anything but display. Seats, queue,
  mute, kick: all keyed by `token`.
- Never send tokens to *other* clients. `presence` carries names only.
- `localStorage` is a convenience. Cleared → new token → new person. That's
  fine and by design.

---

# Part D — Chat

## Step 14 — Room chat

**Requirements**
- [ ] Client sends `{ type: "chat", text }`. Server stamps `{ type: "chat", from: name, text, at: Date.now() }` and broadcasts to everyone
- [ ] Server: reject text > 200 chars; rate limit 1 message / 500 ms per token (drop silently, or reply `{ type: "error", text }`)
- [ ] Server: system messages `{ type: "system", text }` for join / leave / "X takes the left seat" / "X wins 5–3"
- [ ] Client: message list in `useState` (array), capped at last 200. Auto-scroll to bottom unless the user scrolled up
- [ ] Client: `<input>` + Enter to send. Escape must NOT toggle pause while the input is focused (check `document.activeElement`)
- [ ] Client: **mute by name** — a local `Set<string>` in `useState`; muted names' messages are filtered out at render. Purely client-side, nothing sent

**Hints**
- Chat is `useState`, not a ref: it changes rarely and it IS the JSX.
- No history on connect. You see what happens after you arrive. (Persistence
  is decision #2 — sending the last 50 from server memory is a 3-line
  upgrade if you want it.)
- Old 42 subject checklist covered here: DMs (skipped — one room), block
  (= mute), channels (skipped — one room).

---

# Part E — The game session lives on the server

This is the heart of the project. Read the state machine below until it
feels obvious, then code it top-down.

## Session state machine
```
IDLE ──(Play / AI-vs-AI)──► COUNTDOWN ──(3 s)──► PLAYING ──(score 5)──► FINISHED ──(5 s)──► IDLE or COUNTDOWN
                                                  │  ▲                                        (if queue non-empty)
                                    (human leaves)│  │(wait: they come back)
                                                  ▼  │(continue vs AI)
                                                PAUSED ──(quit / both gone / 30 s + nobody)──► FINISHED
```

```ts
type Seat = { kind: "ai" } | { kind: "human"; token: string };

interface Session {
	phase: "IDLE" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "FINISHED";
	seats: { left: Seat; right: Seat };
	game: GameState;                 // from lib/pong
	inputs: Inputs;                  // latest input per seat, overwritten each message
	queue: string[];                 // tokens waiting for a seat
	pausedBy?: string;               // token of who left
	phaseSince: number;              // Date.now() when phase changed, for timeouts
}
```

## Step 15 — Server game loop & spectating (everyone watches)

**Requirements**
- [ ] Server: one `Session` object in memory. `setInterval(tick, 1000 / 60)`
- [ ] `tick()`: if `PLAYING` → `step(session.game, session.inputs)`; then handle phase timeouts; then broadcast
- [ ] Broadcast `{ type: "state", phase, seats: { left: name|"AI", right: name|"AI" }, ball, paddles, score, queueLength }` — names only, never tokens
- [ ] Broadcast at 30 Hz (every 2nd tick) — 60 is wasted on a 5-number payload but fine if simpler
- [ ] Client: `page.tsx` **stops running `update()`**. On `state` message, write into `stateRef.current`. The `requestAnimationFrame` loop now only calls `render()`
- [ ] Client: phase / seats / score / queue go into `useState` for the JSX (they change rarely). Ball/paddles stay in the ref
- [ ] "AI vs AI" button (visible when `IDLE`) → `{ type: "exhibition" }` → seats both `ai` → `COUNTDOWN`

**Hints**
- You've now split your old `loop()`: `update` half runs in `server.ts`,
  `render` half stays in the browser. Same `GameState` type on both ends.
- The ref/state rule from Part A still holds client-side, unchanged:
  ball → ref (60×/s), phase/score → state (rare).
- Test: open two tabs. Press AI vs AI in one. Both show the same game.
  Insult the AIs in chat. That's Steps 12–15 working together.

---

## Step 16 — Seats, Play button, queue

**Requirements**
- [ ] Client sends `{ type: "play" }`. Server: if a seat is `ai` or `IDLE` → give it to this token (ending an exhibition if one runs). Else push token to `queue` (once)
- [ ] `{ type: "leave" }` → free the seat (→ `PAUSED` if `PLAYING`, see Step 18) or leave the queue
- [ ] Session end (`FINISHED` → next): winner stays; fill `ai` seats then the loser's seat from `queue` in order. If any human seated → `COUNTDOWN`, else `IDLE`
- [ ] Client: input handling changes — keys no longer move a paddle locally. Rising/falling edge → send `{ type: "input", dir: "up" | "down" | null }` **only when it changes**, not every frame
- [ ] Server: `input` from a token only affects the seat that token holds. Spectators' inputs are ignored
- [ ] Client button label from `state`:
  - not seated, a seat is `ai` or `IDLE` → **Play now**
  - not seated, both seats human → **Join queue · N ahead**
  - in queue → **Leave queue**
  - seated → **Leave game**
- [ ] Server: a seated human gets W/S (left) or ↑/↓ (right)? No — **both** humans use W/S *or* arrows; the server maps the token to its seat. Clients don't know left/right, only "up/down"

**Hints**
- Every `play`/`leave`/`input` is authoritative on the server. The client
  never assumes it got the seat — it waits for the next `state`.
- Old 42 checklist covered here: matchmaking (= queue), spectating (= default).

---

## Step 17 — Countdown, win, finished screen

**Requirements**
- [ ] `COUNTDOWN`: 3 s (`phaseSince`), broadcast remaining seconds. Client draws a big number on the canvas
- [ ] `PLAYING` → `step()` returns a scorer → if a score reaches `WIN_SCORE` → `FINISHED`, system chat "X wins 5–2"
- [ ] `FINISHED`: 5 s, client shows winner overlay in JSX. Then the Step 16 end-of-session rule
- [ ] AI seats: each tick, `inputs.left = aiInput(...)` for any `ai` seat, before `step()`

**Hint**
- Human and AI now go through the exact same `inputs` object. If Step 8's
  hint was followed, this is one line per seat.

---

## Step 18 — Disconnect handling (decision #7)

**Requirements**
- [ ] Seated human's socket closes during `PLAYING` → `PAUSED`, `pausedBy = token`, `phaseSince = now`. System chat "X disconnected"
- [ ] Remaining human sees a modal: **Wait for them** / **Continue vs AI** / **Quit**
- [ ] `wait` → stay `PAUSED`. If the same token reconnects (Step 13 `hello`) → seat is still theirs → `COUNTDOWN` (3 s to re-orient) → `PLAYING`, score kept
- [ ] `continue` → that seat becomes `ai` → `COUNTDOWN` → `PLAYING`
- [ ] `quit` → `FINISHED` (no winner)
- [ ] Nobody answers within 30 s → `continue`. Both humans gone → `FINISHED`
- [ ] Exhibition (`ai` vs `ai`) never pauses — nobody's watching that closely

**Hint**
- This is why identity is a token and not a socket. Test it: play, refresh
  the tab mid-game, watch your seat survive.

---

# Part F — Ship it

## Step 19 — Robustness

**Requirements**
- [ ] Server: every incoming message goes through one `parseMessage(raw): ClientMessage | null` — unknown type / bad JSON / wrong field types → ignored. Never `throw` on client input
- [ ] Server: cap connected players (e.g. 50) — reply `{ type: "error", text: "room full" }` and close
- [ ] Client: socket `close` → show "reconnecting…", retry with backoff (1 s, 2 s, 4 s, max 10 s). Same token → you get your seat back (Step 18)
- [ ] Client: window blur → send `input: null` so a held key doesn't stick

---

## Step 20 — Docker & deploy

**Requirements**
- [ ] `Dockerfile`: `npm ci` → `next build` → `CMD ["npm", "start"]`. Single container, single port
- [ ] `docker compose up` starts it. One command, per the 42 tradition
- [ ] Deploy anywhere that runs a long-lived container (Fly.io, Railway, a VPS). **Not** Vercel — WebSockets need a persistent process
- [ ] HTTPS: terminate TLS at a reverse proxy (Caddy is 3 lines and auto-certs). Browser uses `wss://` when `location.protocol === "https:"`
- [ ] README: what it is, how to run, the message protocol table

**Hint**
- `next build` with the custom server: the doc warns `output: "standalone"`
  and custom servers don't mix. Don't set `standalone`.

---

# Part G — Later / maybe (the "we can add it after" pile)

- [ ] Stats & match history — hook: emit a `SESSION_FINISHED` record; append to a JSON file or SQLite. Decision #2 flips here
- [ ] Private rooms via URL (`/room/abc123`) — same `Session` code, keyed by room id
- [ ] Client-side prediction for your own paddle (fixes the ~50–100 ms lag feel)
- [ ] Nicer bounce angle (Step 6 optional bullet), ball speed-up per hit
- [ ] Game customization: paddle size, ball speed, map — vote in chat?
- [ ] Sounds, mobile touch controls, responsive canvas
- [ ] Ladder / achievements — only if stats exist

---

## Appendix — Message protocol (single source of truth)

| Direction | `type` | Fields | Notes |
|-----------|--------|--------|-------|
| C→S | `hello` | `token`, `name` | First message. Reconnect = same token |
| C→S | `chat` | `text` | ≤ 200 chars, ≤ 1 / 500 ms |
| C→S | `play` | — | Take a seat or join queue |
| C→S | `leave` | — | Free seat or leave queue |
| C→S | `input` | `dir: "up" \| "down" \| null` | Only on change |
| C→S | `exhibition` | — | Start AI vs AI (only when `IDLE`) |
| C→S | `resume` | `choice: "wait" \| "ai" \| "quit"` | Only from the remaining human in `PAUSED` |
| S→C | `welcome` | `name` | Name actually assigned |
| S→C | `presence` | `players: { name }[]` | On every join/leave |
| S→C | `chat` | `from`, `text`, `at` | |
| S→C | `system` | `text` | Join/leave/seat/win events |
| S→C | `state` | `phase`, `seats`, `ball`, `paddles`, `score`, `queueLength`, `countdown?`, `you: { seat, queuePos }` | 30 Hz while `PLAYING`, on change otherwise |
| S→C | `error` | `text` | Human-readable, never a stack trace |

Put these as TypeScript types in `lib/protocol.ts`, imported by **both**
`server.ts` and the client. One file, two sides, no drift.

## Suggested file layout

```
server.ts               ← Next + ws. Session, tick, dispatch. No React.
lib/
  pong/
    types.ts            ← Ball, Paddle, GameState, Inputs
    constants.ts        ← PADDLE_*, BALL_*, WIN_SCORE, AI_*
    logic.ts            ← hit, movePaddle, step, aiInput … pure
    logic.test.ts
  protocol.ts           ← ClientMessage / ServerMessage unions
  session.ts            ← Session type + transitions (pure where possible)
app/
  pong/
    page.tsx            ← socket, refs, render loop, JSX (button, chat, overlays)
  components/
    movement.ts         ← KeyboardInput (already done)
    Chat.tsx            ← message list + input + mute
```

## Concepts checklist — what you'll have practiced

- `useRef` for mutable data that shouldn't trigger re-renders
- `useEffect` with cleanup (animation frame + event listeners + sockets)
- Why StrictMode double-mounts effects and how cleanup handles it
- Stale closures, and the `setState(updaterFn)` escape hatch
- Splitting pure game logic from React rendering — and then from the browser
- Authoritative server: clients send intent, server owns truth
- A state machine with timeouts instead of a pile of booleans
- Identity without accounts: token = who, name = label
- Designing a message protocol both sides share
