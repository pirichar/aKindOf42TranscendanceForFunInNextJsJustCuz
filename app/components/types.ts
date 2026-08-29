// Shared game data shapes. Pure types — no React, no logic.

export interface Ball {
	x: number;
	y: number;
	r: number;
	vx: number;
	vy: number;
}

export interface Paddle {
	x: number;
	y: number;
	w: number;
	h: number;
}
export interface Score {
	left: number,
	right: number,
}

export interface GameState {
	ball: Ball;
	left: Paddle;
	right: Paddle;
	score: Score;
}

export type Phase = "ready" | "countdown" | "playing" | "paused" | "finished";
