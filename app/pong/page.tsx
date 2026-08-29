"use client"

import React, { useEffect, useRef, useState } from "react";
import { KeyboardInput } from "../components/movement";
import type { Ball, Paddle, GameState } from "../components/types";

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
const BALL_YX = 3;

function hit(ball: Ball, paddle: Paddle): boolean {
	return (
		ball.x - ball.r < paddle.x + paddle.w &&
		ball.x + ball.r > paddle.x &&
		ball.y - ball.r < paddle.y + paddle.h &&
		ball.y + ball.r > paddle.y
	);
}

const manageBallBounces = (ball: Ball, ctx: CanvasRenderingContext2D, left: Paddle, right: Paddle) => {
	//ceiling and floor always bounces
	if (ball.y - ball.r <= 0 || ball.y + ball.r >= ctx.canvas.height) {
		ball.vy = -ball.vy;
	}
	if (hit(ball, left)) {
		ball.vx = -ball.vx;
	}
	if (hit(ball, right)) {
		ball.vx = -ball.vx;
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
	ball.vy = BALL_YX;

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

	// JSX only. The loop never reads the score, it only bumps it.
	const [score, setScore] = useState({ left: 0, right: 0 });

	// Both. Loop reads isPausedRef every frame; JSX shows isPaused.
	const isPausedRef = useRef(false);
	const [isPaused, setIsPaused] = useState(false);

	// Loop only. Changes 60x/s; a re-render per frame would be absurd.
	const state = useRef<GameState>({
		ball: {
			x: props.width / 2,
			y: props.height / 2,
			r: BALL_RADIUS,
			vx: BALL_VX,
			vy: BALL_YX,
		},
		left: {
			x: PADDLE_MARGIN,
			y: props.height / 2 - PADDLE_HEIGHT / 2,
			w: PADDLE_WIDTH,
			h: PADDLE_HEIGHT,
		},
		right: {
			x: props.width - PADDLE_MARGIN - PADDLE_WIDTH,
			y: props.height / 2 - PADDLE_HEIGHT / 2,
			w: PADDLE_WIDTH,
			h: PADDLE_HEIGHT,
		},
	});

	const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
		ctx.fillStyle = "#000000";
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
		ctx.fill();
	};

	const drawPaddle = (ctx: CanvasRenderingContext2D, paddle: Paddle) => {
		ctx.fillStyle = "#000000";
		ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
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
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	};

	const drawNet = (ctx: CanvasRenderingContext2D) => {
		ctx.strokeStyle = "#000000";
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

			// setScore(s => ...) : React hands us the REAL current value in s.
			// setScore({ ...score }) would use the frozen first-render score.
			if (scorer === "right") {
				setScore(s => ({ left: s.left, right: s.right + 1 }));
				resetBall(ball, ctx.canvas.width, ctx.canvas.height, -1);
			}
			if (scorer === "left") {
				setScore(s => ({ left: s.left + 1, right: s.right }));
				resetBall(ball, ctx.canvas.width, ctx.canvas.height, 1);
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

		const loop = () => {
			// Rising edge: toggle once per key press, not once per frame held.
			const escapeIsDown = input.isPressed("Escape");
			if (escapeIsDown && !escapeWasDown){
				isPausedRef.current = !isPausedRef.current;	// truth, read below
				setIsPaused(isPausedRef.current);			// mirror, for the JSX
			}
			escapeWasDown = escapeIsDown;

			// Reading the ref, never isPaused: that one is frozen at false here.
			if (!isPausedRef.current) {
				update(context, state.current); //move tings
			}
			render(context, state.current);
			animationFrameId = requestAnimationFrame(loop);
		};
		animationFrameId = requestAnimationFrame(loop);

		return () => {
			window.cancelAnimationFrame(animationFrameId);
			input.destroy();
		};

	}, []);

	return (
		<div>
			<div className="text-white text-3xl text-center font-mono">
				{score.left} — {score.right}
			</div>
			  {isPaused && <div className="text-white text-center">Paused</div>}
			<canvas ref={canvasRef} width={props.width} height={props.height} style={props.style} />
		</div>
	);

};

export default function Page() {
	return (
		<div className="flex justify-center items-center min-h-screen">
			<div>
				<h1 className="text-white font-bold text-5xl font-serif text-center">Pong</h1>
				<Canvas width={800} height={500} style={{ border: '10px solid black' }} />
			</div>
		</div>
	);
}
