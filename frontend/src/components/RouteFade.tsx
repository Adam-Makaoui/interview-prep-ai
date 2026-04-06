import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Route exit/enter wrapper for AnimatePresence + React Router.
 * Respects prefers-reduced-motion.
 */
export default function RouteFade({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{
        duration: reduce ? 0 : 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
