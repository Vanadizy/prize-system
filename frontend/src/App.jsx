import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/login";
import ContestantPage from "./pages/Receiption";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function AdminRoute() {
  const [status, setStatus] = React.useState("checking");
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setStatus("unauthorized"); return; }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setStatus(data?.user?.role === "admin" ? "authorized" : "unauthorized"))
      .catch(() => setStatus("unauthorized"));
  }, []);
  if (status === "checking") return <div className="p-8 text-center text-slate-600">Checking administrator access…</div>;
  if (status !== "authorized") return <Navigate to="/login" replace />;
  return <AdminPanel />;
}

function AppBar() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === "/login") return null;
  const signedIn = Boolean(localStorage.getItem("token"));
  return <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
    <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-8">
      <Link to="/" className="flex items-center gap-3 text-slate-950"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-800 text-xl font-black text-white">P</span><span><strong className="block text-base leading-tight">Prize Check</strong><span className="text-xs text-slate-500">Contest code portal</span></span></Link>
      <div className="flex items-center gap-2 sm:gap-3">{location.pathname === "/" || location.pathname === "/reception" ? <><Link to="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Check a prize</Link><Link to="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Admin login</Link></> : signedIn ? <><Link to="/admin" className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Admin dashboard</Link><button onClick={() => { localStorage.removeItem("token"); navigate("/"); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Log out</button></> : <Link to="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Admin login</Link>}</div>
    </div>
  </nav>;
}

export default function App() {
  return <Router><AppBar /><Routes>
    <Route path="/" element={<ContestantPage />} />
    <Route path="/reception" element={<ContestantPage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/admin" element={<AdminRoute />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Router>;
}
