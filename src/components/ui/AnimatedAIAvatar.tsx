"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedAIAvatarProps {
	isThinking?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
	showScanLines?: boolean;
}

const sizeMap = {
	sm: 40,
	md: 64,
	lg: 96,
};

export default function AnimatedAIAvatar({
	isThinking = false,
	size = "md",
	className,
	showScanLines = false,
}: AnimatedAIAvatarProps) {
	const sizePx = sizeMap[size];

	return (
		<div className={cn("relative", className)} style={{ width: sizePx, height: sizePx }}>
			{/* Outer glow ring */}
			<motion.div
				className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600"
				animate={
					isThinking
						? {
								scale: [1, 1.05, 1],
								opacity: [0.6, 0.8, 0.6],
							}
						: {
								scale: 1,
								opacity: 0.4,
							}
				}
				transition={{
					duration: 2,
					repeat: isThinking ? Infinity : 0,
					ease: "easeInOut",
				}}
				style={{
					filter: "blur(8px)",
				}}
			/>

			{/* Main avatar circle */}
			<motion.div
				className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600"
				animate={
					isThinking
						? {
								scale: [1, 1.02, 1],
							}
						: {}
				}
				transition={{
					duration: 1.5,
					repeat: isThinking ? Infinity : 0,
					ease: "easeInOut",
				}}
			>
				<div className="absolute inset-0 rounded-full ring-2 ring-white/30" />
			</motion.div>

			{/* Scanning lines */}
			{showScanLines && (
				<div className="absolute inset-0 rounded-full overflow-hidden">
					<motion.div
						className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent"
						animate={{
							y: ["-100%", "200%"],
						}}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "linear",
						}}
						style={{
							height: "30%",
						}}
					/>
				</div>
			)}

			{/* Inner pulse dot */}
			<motion.div
				className="absolute inset-0 flex items-center justify-center"
				animate={
					isThinking
						? {
								scale: [1, 1.2, 1],
								opacity: [0.8, 1, 0.8],
							}
						: {}
				}
				transition={{
					duration: 1,
					repeat: isThinking ? Infinity : 0,
					ease: "easeInOut",
				}}
			>
				<div className="w-2 h-2 rounded-full bg-white" />
			</motion.div>
		</div>
	);
}
