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
"The server" is one Cloudflare Durable Object: a single always-consistent
instance with memory and WebSockets. The Next site on Vercel is just the screen.

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
| 10 | Hosting | Site = Next on **Vercel** (Hobby, free). Game server = **Cloudflare Worker + one Durable Object** (free plan). Two repos-in-one, two `git push` deploys. No Docker, no VPS. Vercel can't host the game: new WS connections aren't pinned to one instance and functions die at 5 min. |

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
- [x] Nicer bounce (optional): the further from the paddle's center the ball hits, the steeper the angle → set `vy` based on `(ball.y - paddleCenter) / (paddle.h / 2)` (see 6b)

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

### Step 6b — Nicer bounce, in detail

`hit()` stays a yes/no question. The *reaction* to a hit gets its own function,
and `manageBallBounces` just wires them: `if (hit(ball, left)) bounceOffPaddle(ball, left, 1)`.
Everything that happens "on paddle hit" — angle, push-out, speed-up — lives in
that one function.

**Requirements**
- [x] `bounceOffPaddle(ball, paddle, dir)` where `dir` is `1` (ball leaves toward the right = left paddle was hit) or `-1`
- [x] Angle from where it hit: `offset = (ball.y - paddleCenter) / (paddle.h / 2)` → `-1` top edge, `0` dead center, `+1` bottom edge. Clamp to `[-1, 1]` (the ball's radius lets it hit slightly outside)
- [x] `ball.vy = offset * BALL_MAX_VY` — new constant, try `6`. (went with 10) Center hit → flat return; edge hit → steep
- [x] `ball.vx = Math.abs(ball.vx) * dir` — sets direction explicitly instead of flipping, so a double-hit can never send it back into the paddle
- [x] Push-out (kills the stuck bug for good): `dir === 1 ? ball.x = paddle.x + paddle.w + ball.r : ball.x = paddle.x - ball.r`
- [x] Optional: `ball.vx *= 1.05` on every paddle hit, capped at `BALL_MAX_VX` — rallies get tense (cap = 20)

**Pseudocode**
```ts
function bounceOffPaddle(ball: Ball, paddle: Paddle, dir: 1 | -1): void {
	const center = paddle.y + paddle.h / 2;
	const offset = clamp((ball.y - center) / (paddle.h / 2), -1, 1);

	ball.vy = offset * BALL_MAX_VY;
	ball.vx = Math.min(Math.abs(ball.vx) * 1.05, BALL_MAX_VX) * dir;

	if (dir === 1) ball.x = paddle.x + paddle.w + ball.r;
	else           ball.x = paddle.x - ball.r;
}

// in manageBallBounces:
if (hit(ball, left))  bounceOffPaddle(ball, left, 1);
if (hit(ball, right)) bounceOffPaddle(ball, right, -1);
```

**Hints**
- `clamp(v, lo, hi)` is `Math.max(lo, Math.min(hi, v))`. Put it in `lib/pong/logic.ts`
  once you're in Part B; until then, next to `hit`.
- Why `dir` as a parameter instead of guessing from `paddle.x`: the function then
  knows nothing about the canvas or which side is which — pure, testable, and
  it still works if you ever have 4 paddles.
- With this, `vx` is constant-ish and `vy` varies, so the ball is faster on
  steep returns. That's how the 1972 arcade did it and it feels right. The
  "constant speed, variable angle" version (`vx = cos(a)·speed`, `vy = sin(a)·speed`)
  is a 3-line swap later if you disagree.
- Once `bounceOffPaddle` exists, the "only flip when moving toward the paddle"
  guard is unnecessary: the push-out guarantees the ball is outside after the hit.

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

## Step 9 — Game flow: a state machine (local)

Landing on the page shows a Start menu. Start → 3-2-1 countdown → play.
Esc opens a Pause menu (Resume / Restart). First to 5 → "X wins" menu (Play again).

This is the same state machine the server will run in Part E. You're building
it in the browser first. The UI is done: `components/menu.tsx` exports
`Menu` and `Countdown` (see 9f). Everything else is yours.

**The big idea: one `phase` instead of booleans**
```ts
type Phase = "ready" | "countdown" | "playing" | "paused" | "finished";
```
Five states in booleans would be `!isReady && !isPaused && !isFinished…` hell.
One variable, five values, and `switch` on it.

```
ready ──Start──► countdown ──3 s──► playing ──Esc──► paused ──Esc/Resume──► countdown
                    ▲                  │                 │
                    │                  └──score 5──► finished ──Play again──┐
                    └────────────────────────────── Restart ◄───────────────┘
```

Do the sub-steps in order. Each one compiles and runs on its own.

### 9a — `phase` replaces `isPaused`

**Requirements**
- [x] `type Phase = …` at module level (top of `page.tsx`) (put it in `components/types.ts` instead — better, it's shared)
- [x] `phaseRef = useRef<Phase>("ready")` (the loop reads it) + `[phase, setPhaseState] = useState<Phase>("ready")` (the JSX shows it) — same both-ways pattern as `isPausedRef`/`isPaused`
- [x] `phaseSince = useRef(0)` — timestamp of when the current phase started. The countdown needs it
- [x] One helper that sets all three, so you can never forget the mirror:
  ```ts
  const setPhase = useCallback((next: Phase) => {
  	phaseRef.current = next;
  	phaseSince.current = performance.now();
  	setPhaseState(next);
  }, []);
  ```
- [x] Delete `isPausedRef`, `isPaused`, `setIsPaused`
- [x] Loop: `if (phaseRef.current === "playing") update(...)`. Nothing else yet. Game is frozen on load — correct, there's no Start button yet
- [x] Effect dependency array becomes `[setPhase]`

**Why `useCallback`** (new): the effect calls `setPhase`, so the linter wants
it in the dependency array. A plain `const setPhase = () => …` is a NEW function
every render → the effect would re-run every render → your loop restarts 60×/s.
`useCallback(fn, [])` returns the SAME function object every render, so
`[setPhase]` never changes and the effect runs once. `performance.now()` is
`Date.now()`'s cousin: milliseconds, but the same clock `requestAnimationFrame` uses.

### 9b — Score moves into the ref (the trap of the day)

Win check = "did anyone reach 5?" — and the **loop** has to ask that.
Loop reads it → ref. So the score can no longer live only in `useState`.

**Requirements**
- [x] `types.ts`: `export interface Score { left: number; right: number }` and add `score: Score` to `GameState`
- [x] Initial state gets `score: { left: 0, right: 0 }`
- [x] `update()`: `game.score.right += 1` (or `.left`), then mirror: `setScore({ ...game.score })`
- [x] The `setScore(s => …)` updater form goes away. It was needed because state was the truth; now the ref is
- [x] Update or delete the two comment lines above the scoring block

**Hint**
- `{ ...game.score }` = a *copy*. React compares object identity to decide
  whether to re-render; passing `game.score` itself (same object as last time)
  would sometimes not re-render.

### 9c — Countdown

**Requirements**
- [x] `const COUNTDOWN_MS = 3000;` in the constants
- [x] `countdownRef = useRef(3)` + `[countdown, setCountdown] = useState(3)` — both-ways again: the loop computes the digit every frame, but only calls `setCountdown` when it changes (otherwise 60 re-renders/s)
- [x] Loop becomes a `switch (phaseRef.current)`:
  ```ts
  case "countdown": {
  	const elapsed = performance.now() - phaseSince.current;
  	const remaining = Math.ceil((COUNTDOWN_MS - elapsed) / 1000);
  	if (remaining !== countdownRef.current) {
  		countdownRef.current = remaining;
  		setCountdown(remaining);
  	}
  	if (elapsed >= COUNTDOWN_MS) setPhase("playing");
  	break;
  }
  case "playing":
  	update(context, state.current);
  	break;
  ```
  `render()` stays *after* the switch — always draw, whatever the phase
- [x] Temporarily start in `"countdown"` instead of `"ready"` to test: the game should start after 3 s

**Hint**
- `Math.ceil`, not `floor`: at 2999 ms elapsed there's 1 ms left → ceil gives 1,
  floor would give 0 and you'd flash a "0" for a frame. 3-2-1, never 0.

### 9d — Escape drives the pause menu

**Requirements**
- [x] Keep the rising-edge block, change what it does:
  ```ts
  if (phaseRef.current === "playing") setPhase("paused");
  else if (phaseRef.current === "paused") setPhase("countdown");
  ```
- [x] Resume goes *through the countdown*: 3 s to get your hands back on the keys
- [x] Esc does nothing in `ready` / `finished`. The menu buttons own those

### 9e — Win + restart

**Requirements**
- [x] `const WIN_SCORE = 5;`
- [x] In `update()`, right after a point:
  ```ts
  if (game.score.left >= WIN_SCORE || game.score.right >= WIN_SCORE) {
  	setPhase("finished");
  } else {
  	resetBall(...);
  }
  ```
  No `resetBall` on a win — otherwise the ball rolls around under the menu
- [x] Turn the big object literal in `useRef<GameState>({ … })` into a module-level function `createGameState(width, height): GameState`. Call it for the initial ref. (That's Step 10's first bullet, done early)
- [x] `restart()` in the component body — resets the ref **and** the state **and** the phase:
  ```ts
  const restart = () => {
  	state.current = createGameState(props.width, props.height);
  	setScore({ left: 0, right: 0 });
  	setPhase("countdown");
  };
  ```

### 9f — Wire the overlays

`components/menu.tsx` (already written) exports:
```ts
<Menu title="…" subtitle?="…" actions={[{ label, onClick, primary? }]} />
<Countdown value={3} />
```
Both are `absolute inset-0` — they fill their parent. So:

**Requirements**
- [ ] Add `relative` to the canvas frame `<div className="trait rounded-bulle …">`
- [ ] Inside that div, after the `<canvas>`, one overlay per phase:
  - `phase === "ready"` → `Menu` "Pong Arena", subtitle with the controls, one primary action `Start` → `setPhase("countdown")`
  - `phase === "countdown"` → `<Countdown value={countdown} />`
  - `phase === "paused"` → `Menu` "Paused", actions `Resume` (→ countdown, primary) and `Restart` (→ `restart`)
  - `phase === "finished"` → `Menu` "Left wins!" / "Right wins!" (compare `score.left` and `score.right`), subtitle `5 — 3`, action `Play again` → `restart`
- [ ] Remove the `Paused` pill from the scoreboard; the menu replaces it. `vs` stays
- [ ] Set the initial phase back to `"ready"`

**Hints**
- `{phase === "ready" && <Menu … />}` — the JSX idiom for `if`. `&&` returns
  the right side when the left is true, `false` otherwise, and React renders
  `false` as nothing.
- `Menu` and the buttons call `setPhase` / `restart` from the *component body* —
  that's the JSX side, where state and refs are both fine to touch.
- Test the whole flow: land → Start → 3-2-1 → play → Esc → Resume → 3-2-1 →
  play to 5 → "X wins" → Play again → 3-2-1. Then Restart from the pause menu.

### 9g — Done when

- [ ] `npx tsc --noEmit` clean, `npx eslint app/` clean (no `exhaustive-deps` warning)
- [ ] `grep -n isPaused app/page.tsx` returns nothing
- [ ] Old bullets, for the record:
  - [x] Pause/resume (Escape; rising-edge toggle)
  - [ ] Win condition: first to 5 → overlay
  - [ ] Restart button that resets score (state) *and* positions (ref)

**Ideas if you want more**
- Resume skips the countdown (just `setPhase("playing")`) if the 3 s annoys you
- Space also starts / resumes
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

## Step 12 — Game server: a Cloudflare Worker + one Durable Object

Read first (30 min, worth it):
- https://developers.cloudflare.com/durable-objects/get-started/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/  (Hibernation API)

**Requirements**
- [ ] `npm create cloudflare@latest game -- --type hello-world-durable-object` (or by hand: `game/wrangler.jsonc`, `game/src/index.ts`). TypeScript, no framework
- [ ] `wrangler.jsonc`: one Durable Object binding `ARENA` → class `Arena`, SQLite-backed (`new_sqlite_classes` — the only kind on the free plan)
- [ ] Worker `fetch()`: if `Upgrade: websocket` → `env.ARENA.idFromName("main")` → forward the request to that one object. Everything else → 404. One name = one arena, worldwide
- [ ] `Arena` class: in `fetch()`, `new WebSocketPair()`, `this.ctx.acceptWebSocket(server)`, return the client half with status 101
- [ ] `webSocketMessage(ws, raw)` / `webSocketClose(ws)` handlers on the class — log them for now
- [ ] `wrangler dev` runs it on `localhost:8787`. Browser: a `useEffect` opens `new WebSocket(process.env.NEXT_PUBLIC_WS_URL)`, logs `open`/`close`. Cleanup closes it
- [ ] `.env.local`: `NEXT_PUBLIC_WS_URL=ws://localhost:8787`. Later on Vercel: `wss://<worker>.<you>.workers.dev`

**Pseudocode**
```ts
// game/src/index.ts
export class Arena extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);          // hibernation-aware accept
		return new Response(null, { status: 101, webSocket: pair[0] });
	}
	webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) { /* JSON.parse, dispatch */ }
	webSocketClose(ws: WebSocket) { /* remove player */ }
}

export default {
	fetch(request: Request, env: Env) {
		if (request.headers.get("Upgrade") !== "websocket") return new Response(null, { status: 404 });
		return env.ARENA.get(env.ARENA.idFromName("main")).fetch(request);
	},
};
```

**Hints**
- Why not the Next server: Route Handlers can't hold a socket open, and Vercel
  doesn't pin connections to one instance. Why not a Node `ws` server: it needs
  an always-on box you'd have to babysit. The DO is the always-on box, for free.
- `game/` has its own `package.json` and `tsconfig.json`. It imports `../lib/pong/*`
  and `../lib/protocol.ts` — that's why Part B forbids Node/DOM code in `lib/`.
- A WebSocket has no CORS. Check `request.headers.get("Origin")` against an
  allowlist in the Worker `fetch()`, or anyone can connect a bot to your arena.
- StrictMode will open/close the socket twice in dev. If your cleanup closes
  it, that's correct behavior, not a bug.
- `wrangler dev` + `next dev` = two terminals. Get used to it.

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
- Durable Object detail: a hibernating object loses its JS memory but keeps
  its sockets. Stash `{ token, name }` on each socket with
  `ws.serializeAttachment(...)` and read it back with `ws.deserializeAttachment()`
  — then `Map<token, Player>` can be rebuilt from `this.ctx.getWebSockets()`
  on wake. (Only matters once the loop is stopped; see Step 15.)

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
- [ ] Server: one `Session` object as a field on the `Arena` class
- [ ] `setInterval(tick, 1000 / 60)` — **start it when the phase leaves `IDLE`, `clearInterval` when it returns to `IDLE`.** No loop while nobody plays: the object hibernates and costs nothing (decision #8, for free)
- [ ] `tick()`: if `PLAYING` → `step(session.game, session.inputs)`; then handle phase timeouts; then broadcast
- [ ] Broadcast `{ type: "state", phase, seats: { left: name|"AI", right: name|"AI" }, ball, paddles, score, queueLength }` — names only, never tokens
- [ ] Broadcast at 30 Hz (every 2nd tick) — 60 is wasted on a 5-number payload but fine if simpler
- [ ] Client: `page.tsx` **stops running `update()`**. On `state` message, write into `stateRef.current`. The `requestAnimationFrame` loop now only calls `render()`
- [ ] Client: phase / seats / score / queue go into `useState` for the JSX (they change rarely). Ball/paddles stay in the ref
- [ ] "AI vs AI" button (visible when `IDLE`) → `{ type: "exhibition" }` → seats both `ai` → `COUNTDOWN`

**Hints**
- You've now split your old `loop()`: `update` half runs in the Durable Object,
  `render` half stays in the browser. Same `GameState` type on both ends.
- Broadcast = `for (const ws of this.ctx.getWebSockets()) ws.send(json)`.
  Outgoing messages are free on the Cloudflare free plan; incoming count 20:1.
  Inputs are sent on change only (Step 16), so you'll never get near the limit.
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
- [ ] Server: `this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))` — client sends `"ping"` every 30 s, the platform answers without waking the object. Keeps proxies from closing idle sockets while the arena is `IDLE`
- [ ] Server: `Session` must survive hibernation. Either keep the object awake only while non-`IDLE` (the interval does that) and rebuild players from socket attachments on wake, or persist `session` to `this.ctx.storage` on each phase change. Start with the first; it's less code

---

## Step 20 — Deploy: Vercel + Cloudflare

**Requirements**
- [ ] `cd game && npx wrangler deploy` → you get `https://<name>.<account>.workers.dev`. TLS is included; the browser uses `wss://` on that host
- [ ] Cloudflare dashboard → Workers → connect the GitHub repo with root dir `game/` so a push deploys it (or keep it manual — it's one command)
- [ ] Vercel → import the repo, framework Next.js, root dir `.`. Env var `NEXT_PUBLIC_WS_URL=wss://<name>.<account>.workers.dev`
- [ ] Worker `Origin` allowlist (Step 12) includes the Vercel domain and `http://localhost:3000`
- [ ] Both `main` pushes deploy. Test from a phone on mobile data — that's the first real network you'll have seen
- [ ] README: what it is, how to run both halves locally, the message protocol table

**Hints**
- Vercel Hobby is for non-commercial use — this project qualifies. No card needed.
- Cloudflare free plan: 100k requests/day, 13,000 GB-s/day. A 128 MB object
  running 24 h is ~11,000 GB-s. You fit even if someone plays all day; and with
  the interval stopped on `IDLE` you'll use a fraction of that.
- A Worker deploy resets the object's memory → everyone's session ends.
  Clients reconnect with their token and land in a fresh `IDLE` arena.
  Decision #2 says that's fine. Don't push mid-tournament.
- Old plan (kept for reference): a Node custom server (`server.ts` + `ws`) in
  Docker on a VPS. Same `lib/`, same protocol, different host. If Cloudflare
  ever annoys you, that's the fallback and it's a day of work.

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
`game/src/index.ts` and `app/page.tsx`. One file, two runtimes, no drift.

## Suggested file layout

```
game/                   ← Cloudflare Worker. Deployed separately. No React.
  wrangler.jsonc
  package.json
  src/
    index.ts            ← Worker fetch() + Arena Durable Object: sockets, tick, dispatch
lib/                    ← shared by BOTH game/ and app/. No Node, no DOM, no React.
  pong/
    types.ts            ← Ball, Paddle, GameState, Inputs
    constants.ts        ← PADDLE_*, BALL_*, WIN_SCORE, AI_*
    logic.ts            ← hit, movePaddle, step, aiInput … pure
    logic.test.ts
  protocol.ts           ← ClientMessage / ServerMessage unions
  session.ts            ← Session type + transitions (pure where possible)
app/                    ← Next site. Deployed to Vercel.
  page.tsx              ← socket, refs, render loop, JSX (button, chat, overlays)
  components/
    movement.ts         ← KeyboardInput (already done)
    logo.tsx            ← (already done)
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
- One codebase, two runtimes (Vercel Functions + Cloudflare Workers) sharing a pure core
- Durable Objects: single-instance state, WebSocket hibernation, paying zero for idle
