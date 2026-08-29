interface MenuAction {
	label: string;
	onClick: () => void;
	primary?: boolean;
}

interface MenuProps {
	title: string;
	subtitle?: string;
	actions: MenuAction[];
}

export function Menu(props: MenuProps) {
	return (
		<div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-encre/40">
			<div className="anim-surgir trait flex min-w-72 flex-col items-center gap-5 rounded-bulle bg-parchemin px-8 py-7 text-center shadow-autocollant-lg">
				<h2 className="font-display text-3xl font-bold text-encre">{props.title}</h2>

				{props.subtitle && (
					<p className="max-w-64 text-encre-doux">{props.subtitle}</p>
				)}

				<div className="flex flex-wrap justify-center gap-3">
					{props.actions.map((action) => (
						<button
							key={action.label}
							type="button"
							onClick={action.onClick}
							className={`autocollant trait rounded-pastille px-5 py-2 font-display text-lg font-semibold text-encre ${action.primary ? "bg-mandarine" : "bg-parchemin"}`}
						>
							{action.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

export function Countdown(props: { value: number }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-encre/40">
			<span
				key={props.value}
				className="anim-surgir trait grid size-40 place-items-center rounded-bulle bg-citron font-display text-8xl font-bold text-encre shadow-autocollant-lg -rotate-3"
			>
				{props.value}
			</span>
		</div>
	);
}
