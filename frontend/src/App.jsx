import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/login";
import ReceptionDashboard from "./pages/Receiption ";

export default function App() {
  return (
    <Router>
      {/* <nav className="bg-blue-600 p-4 text-white flex justify-between">
        <Link to="/">Register</Link>
        <Link to="/admin">Admin</Link>
      </nav> */}
      <Routes>
        <Route path="/" element={<ReceptionDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}
