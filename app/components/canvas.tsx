"use client"

import React, { useEffect, useRef } from "react";

type CanvasProps = React.ComponentProps<"canvas">;

const Canvas = (props: CanvasProps) => {

	// Tell useRef what element it will hold. Starts as null until React
	// attaches it, hence the union with null.
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	// Type the ctx parameter — before, TS saw it as "any"
	const draw = (ctx: CanvasRenderingContext2D) => {
		ctx.fillStyle = '#000000'
		ctx.beginPath()
		ctx.arc(50, 100, 20, 0, 2*Math.PI)
		ctx.fill()
	}

	useEffect(() => {
		const canvas = canvasRef.current;
		// canvas can be null (ref not attached yet), and getContext can
		// return null too — TS forces us to guard both before using them
		if (!canvas) return;
		const context = canvas.getContext('2d');
		if (!context) return;

		draw(context)
	}, []);   // note: [] instead of [draw] — draw is recreated every render,
	          // so [draw] would re-run the effect on every render anyway

	return <canvas ref={canvasRef} {...props}/>

}

export default Canvas