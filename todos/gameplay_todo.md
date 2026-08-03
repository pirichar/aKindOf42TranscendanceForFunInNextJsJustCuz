# Pong in React — Step-by-step TODO

Goal: build Pong on a `<canvas>`, driven by React. You already have
`app/components/canvas.jsx` — you'll evolve it into a game.

Key React lesson of this project: **state that changes 60×/second
(ball position) does NOT go in `useState`** — it goes in a `useRef`.
`useState` re-renders React on every change; a game loop redraws the
canvas itself. Score, pause, winner → `useState` (React UI).
Ball/paddle positions → `useRef` (game data).

---

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
- [ ] When the ball's edge (not center — remember the radius) touches the top or bottom, invert `vy`

**Pseudocode**
```
if ball.y - ball.r <= 0 OR ball.y + ball.r >= canvas.height:
    ball.vy = -ball.vy
```

---

## Step 5 — Keyboard-controlled paddle

**Requirements**
- [ ] Player paddle follows keys: W/S (or ArrowUp/ArrowDown)
- [ ] Listen with a `keydown`/`keyup` effect on `window` — and remove the listeners in cleanup
- [ ] Movement should be smooth: track *which keys are held* in a ref, and move the paddle inside the game loop (don't move it directly in the event handler)
- [ ] Clamp the paddle so it can't leave the canvas

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
- [ ] Detect ball–paddle overlap (rectangle vs circle; treating the ball as a small square is fine)
- [ ] On hit: invert `vx`
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
- [ ] When the ball exits left → right player scores; exits right → left player scores
- [ ] Score lives in `useState` and is rendered as JSX (a `<div>` above the canvas — no need to draw text on canvas)
- [ ] After a point: reset ball to center, send it toward whoever just conceded

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

**Pseudocode**
```
center = paddle.y + paddle.h / 2
if center < ball.y - DEADZONE: paddle.y += AI_SPEED
if center > ball.y + DEADZONE: paddle.y -= AI_SPEED
```

---

## Step 9 — Game flow & polish

**Requirements**
- [ ] Pause/resume with Space or a button (`useState` boolean; when paused, skip `update()` but keep rendering)
- [ ] Win condition: first to 5 → show a "X wins — play again?" overlay in JSX
- [ ] Restart button that resets score (state) *and* positions (ref)

**Ideas if you want more**
- Speed the ball up slightly on every paddle hit
- Two-player mode: second paddle on ArrowUp/ArrowDown
- Sounds with the `Audio` API on bounce/score

---

## Suggested file layout

```
app/
  pong/
    page.jsx          ← the page: score display, buttons, renders the game
  components/
    canvas.jsx        ← your existing component (maybe accept a `draw`/`loop` prop)
    PongGame.jsx      ← the game component: refs, effects, game loop
lib/  (or inline at first)
    pong.js           ← pure logic: update(), hit(), reset() — no React!
```

Keeping `update`/`hit` as pure functions (take state, mutate/return it,
no React imports) makes them easy to reason about and even unit-test.

## Concepts checklist — what you'll have practiced

- `useRef` for mutable data that shouldn't trigger re-renders
- `useEffect` with cleanup (animation frame + event listeners)
- Why StrictMode double-mounts effects and how cleanup handles it
- Stale closures, and the `setState(updaterFn)` escape hatch
- Splitting pure game logic from React rendering
