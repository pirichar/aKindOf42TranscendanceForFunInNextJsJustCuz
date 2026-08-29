"use client"

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./components/logo";
import { KeyboardInput } from "./components/movement";
import type { Ball, GameState, Paddle, Phase } from "./components/types";
import { Menu, Countdown } from "./components/menu";

const COLOR = {
  paper: "oklch(0.993 0.013 90)",
  ink: "oklch(0.278 0.058 288)",
  inkGhost: "oklch(0.66 0.032 288)",
  ball: "oklch(0.752 0.169 56)",
};

// What a <Canvas> needs to be given. The "?" means optional.
interface CanvasProps {
  width: number;
  height: number;
  style?: React.CSSProperties;
}

// Game tuning — change a value here, it applies everywhere.
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 10;   // gap between a paddle and its side wall
const PADDLE_SPEED = 10;     // pixels per frame
const BALL_RADIUS = 8;
const BALL_VX = 10;
const BALL_VY = 3;
const BALL_MAX_VY = 10;
const BALL_MAX_VX = 20;
const COUNTDOWN_MS = 3000;
const WIN_SCORE = 5;
const TICK_MS = 1000 / 60;

function hit(ball: Ball, paddle: Paddle): boolean {
  return (
    ball.x - ball.r < paddle.x + paddle.w &&
    ball.x + ball.r > paddle.x &&
    ball.y - ball.r < paddle.y + paddle.h &&
    ball.y + ball.r > paddle.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/*
** The ball leaves the paddle at an angle that depends on WHERE it hit:
** middle = flat shot, edge = steep shot. That's how a player aims.
**
** offset : where it hit, from -1 (top edge) through 0 (center) to 1 (bottom edge).
**          (ball.y - center) is the distance in px; dividing by half the paddle
**          height turns it into that -1..1 number. clamp() because the ball is
**          a circle and its center can poke a few px past the edge.
** vy     : offset * max  ->  0 in the middle, full speed at the edges.
** vx     : 5% faster each hit, capped, then pointed in `dir`
**          (1 = right, left paddle was hit ; -1 = left). Setting the direction
**          instead of flipping it means a double hit can't send it backwards.
** x      : teleport the ball to the paddle's face, one radius away. hit() fired
**          while overlapping, so without this it could fire again next frame.
*/
function bounceOffPaddle(ball: Ball, paddle: Paddle, dir: 1 | -1): void {
  const center = paddle.y + paddle.h / 2;
  const offset = clamp((ball.y - center) / (paddle.h / 2), -1, 1);

  ball.vy = offset * BALL_MAX_VY;
  ball.vx = Math.min(Math.abs(ball.vx) * 1.05, BALL_MAX_VX) * dir;

  if (dir === 1) {
    ball.x = paddle.x + paddle.w + ball.r;
  } else {
    ball.x = paddle.x - ball.r;
  }
}

const manageBallBounces = (ball: Ball, ctx: CanvasRenderingContext2D, left: Paddle, right: Paddle) => {
  //ceiling and floor always bounces
  if (ball.y - ball.r <= 0 || ball.y + ball.r >= ctx.canvas.height) {
    ball.vy = -ball.vy;
  }
  if (hit(ball, left)) {
    bounceOffPaddle(ball, left, 1);
  }
  if (hit(ball, right)) {
    bounceOffPaddle(ball, right, -1);
  }
};

function checkScore(ball: Ball, canvasWidth: number): "left" | "right" | null {
  if (ball.x + ball.r < 0) return "right";
  if (ball.x - ball.r > canvasWidth) return "left";
  return null;
}

function resetBall(ball: Ball, canvasWidth: number, canvasHeight: number, direction: number) {
  ball.x = canvasWidth / 2;
  ball.y = canvasHeight / 2;
  ball.vx = BALL_VX * direction;
  ball.vy = BALL_VY;

}

function createGameState(width: number, height: number): GameState {
  return {
    ball: {
      x: width / 2,
      y: height / 2,
      r: BALL_RADIUS,
      vx: BALL_VX,
      vy: BALL_VY,
    },
    left: {
      x: PADDLE_MARGIN,
      y: height / 2 - PADDLE_HEIGHT / 2,
      w: PADDLE_WIDTH,
      h: PADDLE_HEIGHT,
    },
    right: {
      x: width - PADDLE_MARGIN - PADDLE_WIDTH,
      y: height / 2 - PADDLE_HEIGHT / 2,
      w: PADDLE_WIDTH,
      h: PADDLE_HEIGHT,
    },
    score: {
      left: 0,
      right: 0,
    }
  }
}


const Canvas = (props: CanvasProps) => {

  const canvasRef = useRef<HTMLCanvasElement>(null);

  /*
  ** ref vs state
  ** ref   : a plain box (.current). Writing it re-renders nothing.
  **         The game loop can read AND write it every frame.
  ** state : owned by React. Writing it (setX) re-renders the JSX.
  **         The loop can write it, but only ever sees the FIRST value
  **         (the effect ran once, so the closure is frozen).
  **
  ** rule  : loop reads it  -> ref
  **         JSX shows it   -> state
  **         both           -> ref is the truth, state is a mirror
  */

  const [score, setScore] = useState({ left: 0, right: 0 });

  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhaseState] = useState<Phase>("ready");
  const phaseSince = useRef(0);
  // countdownRef = the digit the loop last saw. countdown = what the JSX will show (9f). 
  // We keep the ref only to answer "did the digit change?" — so 
  // setCountdown fires 3 times total, not 60×/s.
  const countdownRef = useRef(3);
  const [countdown, setCountdown] = useState(3);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    phaseSince.current = performance.now();
    setPhaseState(next);
  }, []);

  // Loop only. Changes 60x/s; a re-render per frame would be absurd.
  const state = useRef<GameState>(createGameState(props.width, props.height));

  const restart = () => {
    state.current = createGameState(props.width, props.height);
    setScore({left: 0, right: 0});
    setPhase("countdown");
  }

  const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
    ctx.fillStyle = COLOR.ball;
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };

  const drawPaddle = (ctx: CanvasRenderingContext2D, paddle: Paddle) => {
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 4);
    ctx.fill();
  };

  // Move a paddle by dy pixels (negative = up), clamped so it never
  // leaves the canvas. paddle.y is the TOP edge; paddle.y + paddle.h is the bottom.
  const movePaddle = (paddle: Paddle, dy: number, canvasHeight: number) => {
    const top = paddle.y + dy;
    const bottom = top + paddle.h;

    if (top < 0) {
      paddle.y = 0;
    } else if (bottom > canvasHeight) {
      paddle.y = canvasHeight - paddle.h;
    } else {
      paddle.y = top;
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = COLOR.paper;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  const drawNet = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = COLOR.inkGhost;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]); // 10px dash, 10px gap
    ctx.beginPath();
    ctx.moveTo(ctx.canvas.width / 2, 0); // top middle
    ctx.lineTo(ctx.canvas.width / 2, ctx.canvas.height);  // bottom middle
    ctx.stroke();                         // ← this is what draws it
    ctx.setLineDash([]);                  // reset: line dash is sticky, like fillStyle
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrameId: number;

    const input = new KeyboardInput();

    const update = (ctx: CanvasRenderingContext2D, game: GameState) => {
      //move things here
      const ball = game.ball;
      const left = game.left;
      const right = game.right;

      if (input.isPressed("KeyW")) {
        movePaddle(left, -PADDLE_SPEED, ctx.canvas.height);
      }
      if (input.isPressed("KeyS")) {
        movePaddle(left, PADDLE_SPEED, ctx.canvas.height);
      }

      if (input.isPressed("ArrowUp")) {
        movePaddle(right, -PADDLE_SPEED, ctx.canvas.height);
      }
      if (input.isPressed("ArrowDown")) {
        movePaddle(right, PADDLE_SPEED, ctx.canvas.height);
      }

      ball.x += ball.vx;
      ball.y += ball.vy;

      manageBallBounces(ball, ctx, left, right);

      const scorer = checkScore(ball, ctx.canvas.width);

      if (scorer !== null) {
        if (scorer === "right") {
          game.score.right += 1;
        }
        if (scorer === "left") {
          game.score.left += 1;
        }
        setScore({ ...game.score });
        if (game.score.left >= WIN_SCORE || game.score.right >= WIN_SCORE) {
          setPhase("finished");
        }
        else {
          resetBall(ball, ctx.canvas.width, ctx.canvas.height, scorer === "right" ? -1 : 1);
        }
      }
    };

    //our Draw came here
    const render = (ctx: CanvasRenderingContext2D, game: GameState) => {
      drawBackground(ctx);
      drawNet(ctx);
      drawBall(ctx, game.ball);
      drawPaddle(ctx, game.left);
      drawPaddle(ctx, game.right);
    };

    let escapeWasDown = false;
    let lastTime = performance.now();
    let accumulator = 0;

    const loop = (now: number) => {
      accumulator += now - lastTime;
      lastTime = now;
      if (accumulator > 250) accumulator = 250;
      if (phaseRef.current !== "playing") accumulator = 0;

      // Rising edge: toggle once per key press, not once per frame held.
      const escapeIsDown = input.isPressed("Escape");
      if (escapeIsDown && !escapeWasDown) {
        if (phaseRef.current == "playing") {
          setPhase("paused")
        }
        else if (phaseRef.current === "paused") {
          setPhase("countdown")
        }
      }
      escapeWasDown = escapeIsDown;

      switch (phaseRef.current) {
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
          while (accumulator >= TICK_MS) {
            update(context, state.current);
            accumulator -= TICK_MS;
          }
          break;
      }
      render(context, state.current);
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      input.destroy();
    };

  }, [setPhase]);

  return (
    <div className="anim-surgir flex flex-col items-center gap-5">
      <div className="flex items-center gap-4">
        <ScorePill label="Left" value={score.left} className="-rotate-2 bg-mandarine-clair" />

        <span className="font-display text-lg text-encre-fantome">vs</span>

        <ScorePill label="Right" value={score.right} className="rotate-2 bg-menthe" />
      </div>

      <div className="relative trait rounded-bulle bg-parchemin p-3 shadow-autocollant-lg">
        <canvas
          ref={canvasRef}
          width={props.width}
          height={props.height}
          style={props.style}
          className="block max-w-full rounded-2xl"
        />

        {phase === "ready" && (
          <Menu
            title="Pong Arena"
            subtitle="W / S and ↑ / ↓ to move · Esc to pause"
            actions={[{ label: "Start", onClick: () => setPhase("countdown"), primary: true }]}
          />
        )}

        {phase === "countdown" && <Countdown value={countdown} />}

        {phase === "paused" && (
          <Menu
            title="Paused"
            actions={[
              { label: "Resume", onClick: () => setPhase("countdown"), primary: true },
              { label: "Restart", onClick: restart },
            ]}
          />
        )}

        {phase === "finished" && (
          <Menu
            title={score.left > score.right ? "Left wins!" : "Right wins!"}
            subtitle={`${score.left} — ${score.right}`}
            actions={[{ label: "Play again", onClick: restart, primary: true }]}
          />
        )}
      </div>
    </div>
  );

};

interface ScorePillProps {
  label: string;
  value: number;
  className?: string;
}

const ScorePill = (props: ScorePillProps) => {
  return (
    <div className={`trait flex items-baseline gap-2 rounded-bulle px-4 py-2 shadow-autocollant-sm ${props.className ?? ""}`}>
      <span className="font-display text-sm font-semibold tracking-widest text-encre-doux uppercase">
        {props.label}
      </span>
      <span className="font-display text-3xl font-bold tabular-nums text-encre">
        {props.value}
      </span>
    </div>
  );
};

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b-[3px] border-encre bg-carton px-5 py-3">
        <h1 className="text-[1.3rem] leading-none">
          <Logo />
        </h1>
        <p className="ml-auto font-display text-sm text-encre-doux">
          W / S · ↑ / ↓ · Esc to pause
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <Canvas width={800} height={500} />
      </main>
    </div>
  );
}
