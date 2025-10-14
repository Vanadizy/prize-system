import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/login";
import ReceptionDashboard from "./pages/Receiption";
import DrinksDashboard from "./pages/DrinksPanel";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/register" element= {<Register />} />
        <Route path="/reception" element= {<ReceptionDashboard />} />
        <Route path="/drinks" element= {<DrinksDashboard />} />
      </Routes>
    </Router>
  );
}
