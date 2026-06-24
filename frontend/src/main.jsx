import React, { useEffect, Suspense, lazy } from "react";
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
import { LanguageProvider, useT } from "./i18n.jsx";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import "./styles.css";

const ClinicDashboard = lazy(() => import("./pages/ClinicDashboard.jsx"));
const PatientView = lazy(() => import("./pages/PatientView.jsx"));
const DisplayBoard = lazy(() => import("./pages/DisplayBoard.jsx"));
const ExploreClinics = lazy(() => import("./pages/ExploreClinics.jsx"));
const QuickJoin = lazy(() => import("./pages/QuickJoin.jsx"));

function RouteLoading() {
  return (
    <div className="route-loading">
      <span className="route-spinner" />
    </div>
  );
}

function Protected({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/auth" replace />;
  const clinicSide = account.role === "clinic" || account.role === "staff";
  const home = clinicSide ? "/clinic" : "/patient";
  if (role === "clinic" && !clinicSide) return <Navigate to={home} replace />;
  if (role === "patient" && account.role !== "patient")
    return <Navigate to={home} replace />;
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
  const { lang } = useT();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${location.pathname}::${lang}`}
        className="route-fade"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        <Suspense fallback={<RouteLoading />}>
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
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </MotionConfig>
  </React.StrictMode>
);
