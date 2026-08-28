"use client"

import React, { useEffect, useRef } from "react";
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
const PADDLE_SPEED = 5;     // pixels per frame
const BALL_RADIUS = 8;

const Canvas = (props: CanvasProps) => {

	const canvasRef = useRef<HTMLCanvasElement>(null);
	// initial game state — lives in a useRef, NOT useState
	const state = useRef<GameState>({
		ball: {
			x: props.width / 2,
			y: props.height / 2,
			r: BALL_RADIUS,
			vx: 4,
			vy: 3,
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

			if (ball.y - ball.r <= 0 || ball.y + ball.r >= ctx.canvas.height) {
				ball.vy = -ball.vy;
			}
			if (ball.x - ball.r <= 0 || ball.x + ball.r >= ctx.canvas.width) {
				ball.vx = -ball.vx;
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

		const loop = () => {
			update(context, state.current); //move tings
			render(context, state.current);
			animationFrameId = requestAnimationFrame(loop);
		};
		animationFrameId = requestAnimationFrame(loop);

		return () => {
			window.cancelAnimationFrame(animationFrameId);
			input.destroy();
		};

	}, []);

	return <canvas ref={canvasRef} width={props.width} height={props.height} style={props.style} />;

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
