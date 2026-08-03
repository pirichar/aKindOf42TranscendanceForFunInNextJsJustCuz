"use client"

import React, { useEffect, useRef } from "react";


const Canvas = props => {

	const canvasRef = useRef(null);

	// initial game state — lives in a useRef, NOT useState
	const state = useRef({
		ball:  { x: props.width / 2, y: props.height / 2, r: 8, vx: 4, vy: 3 },
		left:  { x: 10, y: props.height / 2 - 40, w: 12, h: 80 },
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

	const drawNet =  (ctx) => {
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 4;
		ctx.setLineDash([10, 10]); // 10px dash, 10px gap
		ctx.beginPath();
		ctx.moveTo(ctx.canvas.width / 2, 0); // top middle
		ctx.lineTo(ctx.canvas.width /2, ctx.canvas.height);  // bottom middle
		ctx.stroke();                         // ← this is what draws it
		ctx.setLineDash([]);                  // reset: line dash is sticky, like fillStyle
	}

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		let frameCount = 0;
		let animationFrameId;

		//our Draw came here
		const render = () => {
			frameCount++;
			drawBackground(context, frameCount);
			drawNet(context);
			drawBall(context,state.current.ball);
			drawPaddle(context,state.current.left);
			drawPaddle(context,state.current.right);
			animationFrameId = window.requestAnimationFrame(render);
		}
		render();

		return () => {
			window.cancelAnimationFrame(animationFrameId)
		}

	}, [state]);

	return <canvas ref={canvasRef} {...props} />

}

export default function Page() {
	return <Canvas width={800} height={500} style={{ border: '2px solid black' }} />
}
