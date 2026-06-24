import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Receptionist from "./pages/Receptionist.jsx";
import WaitingRoom from "./pages/WaitingRoom.jsx";
import Landing from "./pages/Landing.jsx";
import "./styles.css";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="route-fade" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Landing />} />
        <Route path="/reception" element={<Receptionist />} />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
