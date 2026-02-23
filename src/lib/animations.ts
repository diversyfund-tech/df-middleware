import { type Variants } from "framer-motion";

// Message slide-in animations
export const messageSlideInFromRight: Variants = {
	initial: { opacity: 0, x: 100, scale: 0.95 },
	animate: { opacity: 1, x: 0, scale: 1 },
	exit: { opacity: 0, x: -20, scale: 0.95 },
};

export const messageSlideInFromLeft: Variants = {
	initial: { opacity: 0, x: -100, scale: 0.95 },
	animate: { opacity: 1, x: 0, scale: 1 },
	exit: { opacity: 0, x: 20, scale: 0.95 },
};
