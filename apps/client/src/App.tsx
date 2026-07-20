import { useLocation, Outlet } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { pageSlide, fadeIn } from "@/lib/transitions";

const App = () => {
  const location = useLocation();
  const prefersReduced = useReducedMotion();
  const prefersReducedBool = prefersReduced === true;
  const pageTransition = prefersReducedBool ? fadeIn : pageSlide;

  return (
    <AppShell>
      <AnimatePresence mode="popLayout">
        <motion.div key={location.pathname} {...pageTransition}>
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
};

export default App;
