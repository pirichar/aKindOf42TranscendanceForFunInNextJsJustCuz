// Maps a key code (e.g. "KeyW") to whether it is currently held down.
type KeyMap = Record<string, boolean>;

export class KeyboardInput {

	private keys: KeyMap = {};

	// Stored as fields (not methods) so the SAME function reference
	// can be passed to both addEventListener and removeEventListener.
	private onKeyDown = (e: KeyboardEvent): void => {
		this.keys[e.code] = true;
	};

	private onKeyUp = (e: KeyboardEvent): void => {
		this.keys[e.code] = false;
	};

	constructor() {
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
	}

	public destroy(): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
	}

	public isPressed(code: string): boolean {
		return !!this.keys[code];
	}
}
