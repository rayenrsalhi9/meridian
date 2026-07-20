import { type Transition } from "motion/react";

export const transitions = {
  snappy: { type: "spring", stiffness: 400, damping: 30 } satisfies Transition,
  smooth: { type: "spring", stiffness: 300, damping: 25 } satisfies Transition,
  gentle: { type: "spring", stiffness: 200, damping: 20 } satisfies Transition,
  fade: { duration: 0.15 } satisfies Transition,
} as const;

export const pageSlide = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "-30%", opacity: 0 },
  transition: transitions.smooth,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitions.fade,
};

export const scaleFadeIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: transitions.fade,
};

export const listItem = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.2 },
};
