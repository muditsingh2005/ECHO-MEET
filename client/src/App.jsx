import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages";
import { ProtectedRoute } from "./components";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <h1>Home (Coming Soon)</h1>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
