"use client"

import React, { useEffect, useRef } from "react";


const Canvas = props => {

	const canvasRef = useRef(null);

	// initial game state — lives in a useRef, NOT useState
	const state = useRef({
		ball: { x: props.width / 2, y: props.height / 2, r: 8, vx: 4, vy: 3 },
		left: { x: 10, y: props.height / 2 - 40, w: 12, h: 80 },
		right: { x: props.width - 22, y: props.height / 2 - 40, w: 12, h: 80 },
	});

	const drawBall = (ctx, ball) => {
		ctx.fillStyle = "#000000";
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
		ctx.fill();
	}

	const drawPaddle = (ctx, paddle) => {
		ctx.fillStyle = "#000000";
		ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h)
	}

	const drawBackground = (ctx) => {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	}

	const drawNet = (ctx) => {
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 4;
		ctx.setLineDash([10, 10]); // 10px dash, 10px gap
		ctx.beginPath();
		ctx.moveTo(ctx.canvas.width / 2, 0); // top middle
		ctx.lineTo(ctx.canvas.width / 2, ctx.canvas.height);  // bottom middle
		ctx.stroke();                         // ← this is what draws it
		ctx.setLineDash([]);                  // reset: line dash is sticky, like fillStyle
	}

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		let animationFrameId;


		const update = (game, ctx) => {
			//move things here
			const ball = game.ball;

			game.ball.x += game.ball.vx;
			game.ball.y += game.ball.vy;

			if (ball.y - ball.r <= 0 || ball.y + ball.r >= ctx.canvas.height){
				ball.vy = -ball.vy;
			}
			if (ball.x - ball.r <= 0 || ball.x + ball.r >= ctx.canvas.width){
				ball.vx = -ball.vx;
			}
			

		}

		//our Draw came here
		const render = (ctx, game) => {
			drawBackground(ctx);
			drawNet(ctx);
			drawBall(ctx, game.ball);
			drawPaddle(ctx, game.left);
			drawPaddle(ctx, game.right);
		}

		const loop = () => {
			update(state.current, context); //move tings
			render(context, state.current);
			animationFrameId = requestAnimationFrame(loop);
		}
		animationFrameId = requestAnimationFrame(loop);

		return () => window.cancelAnimationFrame(animationFrameId)

	}, [state]);

	return <canvas ref={canvasRef} {...props} />

}

export default function Page() {
	return (
		<div>
			<div className="flex justify-center items-center min-h-screen">
				<div>
					<h1 className="text-white font-bold text-5xl font-serif text-center">Pong</h1>
					<Canvas width={800} height={500} style={{ border: '10px solid black' }} />
				</div>
			</div>
		</div>)
}
