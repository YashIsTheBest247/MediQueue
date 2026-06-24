import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AuthProvider, useAuth } from "./auth.jsx";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import ClinicDashboard from "./pages/ClinicDashboard.jsx";
import PatientView from "./pages/PatientView.jsx";
import DisplayBoard from "./pages/DisplayBoard.jsx";
import ExploreClinics from "./pages/ExploreClinics.jsx";
import QuickJoin from "./pages/QuickJoin.jsx";
import "./styles.css";

function Protected({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/auth" replace />;
  if (role && account.role !== role)
    return <Navigate to={account.role === "clinic" ? "/clinic" : "/patient"} replace />;
  return children;
}

const pageVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

const pageTransition = { duration: 0.18, ease: "easeOut" };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="route-fade"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/clinic"
            element={
              <Protected role="clinic">
                <ClinicDashboard />
              </Protected>
            }
          />
          <Route
            path="/patient"
            element={
              <Protected role="patient">
                <PatientView />
              </Protected>
            }
          />
          <Route path="/display/:clinicId" element={<DisplayBoard />} />
        <Route path="/explore" element={<ExploreClinics />} />
        <Route path="/j/:clinicId" element={<QuickJoin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  </React.StrictMode>
);
