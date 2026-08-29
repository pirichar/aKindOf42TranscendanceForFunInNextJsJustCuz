export function Logo({ className = "" }: { className?: string }) {
	return (
		<span className={`font-display font-bold whitespace-nowrap text-encre ${className}`}>
			PONG
			<span className="trait-fin mx-1 inline-block -rotate-2 rounded-[0.55rem] bg-mandarine px-1.5 py-0.5">
				ARENA
			</span>
		</span>
	);
}
