import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import ClinicDashboard from "./pages/ClinicDashboard.jsx";
import PatientView from "./pages/PatientView.jsx";
import DisplayBoard from "./pages/DisplayBoard.jsx";
import "./styles.css";

function Protected({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/auth" replace />;
  if (role && account.role !== role)
    return <Navigate to={account.role === "clinic" ? "/clinic" : "/patient"} replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="route-fade" key={location.pathname}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
