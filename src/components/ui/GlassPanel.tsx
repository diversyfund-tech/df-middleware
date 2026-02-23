import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface GlassPanelProps {
	children: ReactNode;
	className?: string;
	variant?: "default" | "glow" | "holographic";
	onClick?: () => void;
}

export default function GlassPanel({ children, className, variant = "default", onClick }: GlassPanelProps) {
	const variantStyles = {
		default: "backdrop-blur-xl bg-background/50 dark:bg-white/5 border border-border shadow-[0_0_40px_rgba(0,0,0,0.05)] dark:shadow-[0_0_40px_rgba(255,255,255,0.05)]",
		glow: "backdrop-blur-xl bg-background/50 dark:bg-white/5 border border-border shadow-[0_0_20px_rgba(0,150,255,0.3)] dark:shadow-[0_0_20px_rgba(0,150,255,0.2)]",
		holographic: "backdrop-blur-xl bg-gradient-to-br from-background/50 via-cyan-500/10 to-blue-500/10 dark:from-white/5 dark:via-cyan-500/5 dark:to-blue-500/5 border border-cyan-500/30 dark:border-cyan-500/20 shadow-[0_0_30px_rgba(0,150,255,0.4)] dark:shadow-[0_0_30px_rgba(0,150,255,0.3)]",
	};

	return (
		<div
			className={cn(
				"rounded-2xl p-6 transition-all duration-300",
				variantStyles[variant],
				className,
			)}
			onClick={onClick}
		>
			{children}
		</div>
	);
}
