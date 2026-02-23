import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<h1>Dashboard (Coming Soon)</h1>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
