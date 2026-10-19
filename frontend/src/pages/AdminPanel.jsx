import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_ORIGIN = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_ORIGIN}/api`;
const blankPrize = { outcome: "", prize: "", description: "" };

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

async function errorMessage(error, fallback) {
  const body = error.response?.data;
  if (body instanceof Blob) {
    try { return JSON.parse(await body.text()).message || fallback; } catch { return fallback; }
  }
  return body?.message || fallback;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminPanel() {
  const [codes, setCodes] = useState([]);
  const [range, setRange] = useState({ start: "", end: "" });
  const [ticketWindow, setTicketWindow] = useState({ startsAt: "", expiresAt: "" });
  const [credentials, setCredentials] = useState({ currentPassword: "", username: "", newPassword: "" });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("token"));
  const [prize, setPrize] = useState(blankPrize);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const auth = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);

  const loadCodes = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/contestants`, { headers: auth });
      setCodes(data.contestants || []);
    } catch (error) { setMessage(error.response?.data?.message || "Could not load prize IDs."); }
  }, [auth]);
  useEffect(() => {
    loadCodes();
    const refreshTimer = window.setInterval(loadCodes, 5000);
    return () => window.clearInterval(refreshTimer);
  }, [loadCodes]);

  const loadTicketWindow = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/settings/ticket-window`, { headers: auth });
      setTicketWindow({ startsAt: toLocalDateTime(data.ticketWindow?.starts_at), expiresAt: toLocalDateTime(data.ticketWindow?.expires_at) });
    } catch (error) { setMessage(error.response?.data?.message || "Could not load ticket expiry settings."); }
  }, [auth]);
  useEffect(() => { loadTicketWindow(); }, [loadTicketWindow]);

  const visibleCodes = useMemo(() => codes.filter((code) => {
    const q = search.trim().toLowerCase();
    return !q || String(code.id).includes(q) || code.prize?.toLowerCase().includes(q) || code.description?.toLowerCase().includes(q) || code.outcome?.includes(q);
  }), [codes, search]);
  const usedCount = useMemo(() => codes.filter((code) => code.used_at).length, [codes]);
  const remainingCount = codes.length - usedCount;
  const validRange = () => {
    const start = Number(range.start); const end = Number(range.end);
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start > 0 && end >= start && end - start < 5000;
  };

  const createRange = async () => {
    if (!validRange()) { setMessage("Enter a valid positive ID range (up to 5,000 codes)."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_URL}/contestants/range`, { start: Number(range.start), end: Number(range.end) }, { headers: auth });
      setMessage(`${data.message}${data.skipped?.length ? ` Skipped ${data.skipped.length} IDs that already existed.` : ""}`);
      await loadCodes();
    } catch (error) { setMessage(await errorMessage(error, "Could not generate the QR codes.")); }
    finally { setBusy(false); }
  };

  const saveTicketWindow = async () => {
    if (!ticketWindow.startsAt || !ticketWindow.expiresAt) { setMessage("Choose both a start time and an expiration time."); return; }
    if (new Date(ticketWindow.startsAt) >= new Date(ticketWindow.expiresAt)) { setMessage("The expiration time must be after the start time."); return; }
    setBusy(true);
    try {
      const { data } = await axios.put(`${API_URL}/settings/ticket-window`, { startsAt: toIsoDateTime(ticketWindow.startsAt), expiresAt: toIsoDateTime(ticketWindow.expiresAt) }, { headers: auth });
      setMessage(data.message);
      await loadTicketWindow();
    } catch (error) { setMessage(error.response?.data?.message || "Could not save ticket expiry settings."); }
    finally { setBusy(false); }
  };

  const clearTicketWindow = async () => {
    setBusy(true);
    try {
      const { data } = await axios.put(`${API_URL}/settings/ticket-window`, { startsAt: null, expiresAt: null }, { headers: auth });
      setTicketWindow({ startsAt: "", expiresAt: "" });
      setMessage(data.message);
    } catch (error) { setMessage(error.response?.data?.message || "Could not clear ticket expiry settings."); }
    finally { setBusy(false); }
  };

  const updateCredentials = async () => {
    if (!credentials.currentPassword || !credentials.username.trim() || !credentials.newPassword) {
      setMessage("Enter your current password, a new username, and a new password.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.put(`${API_URL}/admin/credentials`, { ...credentials, username: credentials.username.trim() }, { headers: auth });
      localStorage.setItem("token", data.token);
      setAuthToken(data.token);
      setCredentials({ currentPassword: "", username: "", newPassword: "" });
      setMessage(data.message);
    } catch (error) { setMessage(error.response?.data?.message || "Could not update administrator credentials."); }
    finally { setBusy(false); }
  };

  const downloadRange = async () => {
    if (!validRange()) { setMessage("Enter a valid ID range first."); return; }
    setBusy(true);
    try {
      const response = await axios.get(`${API_URL}/contestants/qrcodes.zip`, { params: range, headers: auth, responseType: "blob" });
      saveBlob(response.data, `qrcodes_${range.start}-${range.end}.zip`);
      setMessage("QR code ZIP downloaded.");
    } catch (error) { setMessage(await errorMessage(error, "Could not download that range.")); }
    finally { setBusy(false); }
  };

  const downloadOne = async (id) => {
    try {
      const response = await axios.get(`${API_URL}/contestants/${id}/qrcode`, { headers: auth, responseType: "blob" });
      saveBlob(response.data, `qrcode_${id}.png`);
    } catch (error) { setMessage(await errorMessage(error, `Could not download QR ${id}.`)); }
  };

  const downloadSelected = async () => {
    if (!selected.length) { setMessage("Select one or more QR codes first."); return; }
    setBusy(true);
    try {
      const response = await axios.post(`${API_URL}/contestants/qrcodes/selected.zip`, { ids: selected }, { headers: auth, responseType: "blob" });
      saveBlob(response.data, "selected_qrcodes.zip");
      setMessage(`Downloaded ${selected.length} selected QR code${selected.length === 1 ? "" : "s"}.`);
    } catch (error) { setMessage(await errorMessage(error, "Could not download selected QR codes.")); }
    finally { setBusy(false); }
  };

  const editCode = (code) => {
    setEditingId(code.id);
    setSelected([code.id]);
    setPrize({ outcome: code.outcome || "", prize: code.prize || "", description: code.description || "" });
  };

  const savePrize = async () => {
    if (!selected.length) { setMessage("Select one or more prize IDs first."); return; }
    if (!prize.outcome) { setMessage("Choose Winner or Not a winner."); return; }
    if (prize.outcome === "winner" && (!prize.prize.trim() || !prize.description.trim())) { setMessage("Enter both a prize title and prize message for a winner."); return; }
    if (prize.outcome === "not_winner" && !prize.description.trim()) { setMessage("Enter a try again message."); return; }
    const payload = { outcome: prize.outcome, prize: prize.outcome === "winner" ? prize.prize.trim() : "", description: prize.description.trim() };
    setBusy(true);
    try {
      if (selected.length === 1) {
        const { data } = await axios.put(`${API_URL}/contestants/${selected[0]}`, payload, { headers: auth });
        setMessage(data.message);
      } else {
        const { data } = await axios.post(`${API_URL}/contestants/bulk-update`, { ids: selected, ...payload }, { headers: auth });
        setMessage(data.message);
      }
      await loadCodes();
      setPrize(blankPrize);
      setEditingId(null);
    } catch (error) { setMessage(error.response?.data?.message || "Could not save prize information."); }
    finally { setBusy(false); }
  };

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectVisible = () => {
    const all = visibleCodes.length && visibleCodes.every((code) => selected.includes(code.id));
    setSelected((current) => all ? current.filter((id) => !visibleCodes.some((code) => code.id === id)) : [...new Set([...current, ...visibleCodes.map((code) => code.id)])]);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-800 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Administrator workspace</p>
          <h1 className="mt-2 text-3xl font-bold">Prize code management</h1>
          <p className="mt-2 text-blue-100">Create numbered QR codes, assign prize details, preview every code, and download codes for printing.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-sm text-blue-100">Total tickets</p><p className="mt-1 text-2xl font-bold">{codes.length}</p></div><div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-sm text-blue-100">Used tickets</p><p className="mt-1 text-2xl font-bold">{usedCount}</p></div><div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-sm text-blue-100">Remaining tickets</p><p className="mt-1 text-2xl font-bold">{remainingCount}</p></div></div><p className="mt-3 text-sm text-blue-100">{selected.length} selected</p>
        </header>

        {message && <div role="status" className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss" className="text-lg">×</button></div>}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-800">Step 1</p><h2 className="mt-1 text-xl font-bold">Generate QR codes</h2><p className="mt-1 text-sm text-slate-600">Codes are saved as <code>backend/qrcodes/qrcode_ID.png</code>.</p></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className="text-sm font-semibold">First ID<input type="number" min="1" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} placeholder="e.g. 1001" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
            <label className="text-sm font-semibold">Last ID<input type="number" min="1" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} placeholder="e.g. 1100" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
            <button disabled={busy} onClick={createRange} className="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Create range</button>
            <button disabled={busy} onClick={downloadRange} className="rounded-lg border border-blue-800 px-5 py-2.5 font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50">Download range ZIP</button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Ticket availability</p>
          <h2 className="mt-1 text-xl font-bold">Set the scan time window</h2>
          <p className="mt-1 text-sm text-slate-600">Tickets can be scanned from the start time through the expiration time. Times use this device’s local timezone. Leave limits cleared to allow scans at any time.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Valid from<input type="datetime-local" value={ticketWindow.startsAt} onChange={(event) => setTicketWindow((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
            <label className="text-sm font-semibold">Expires at<input type="datetime-local" value={ticketWindow.expiresAt} onChange={(event) => setTicketWindow((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={saveTicketWindow} className="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Save scan window</button><button disabled={busy} onClick={clearTicketWindow} className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Clear time limits</button></div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Account security</p>
          <h2 className="mt-1 text-xl font-bold">Change administrator credentials</h2>
          <p className="mt-1 text-sm text-slate-600">Confirm your current password. A new password must be at least 8 characters. Other administrator sessions will be signed out.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold">Current password<input type="password" autoComplete="current-password" value={credentials.currentPassword} onChange={(event) => setCredentials((current) => ({ ...current, currentPassword: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
            <label className="text-sm font-semibold">New username<input type="text" autoComplete="username" minLength={3} maxLength={50} value={credentials.username} onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="Letters, numbers, . _ -" /></label>
            <label className="text-sm font-semibold">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={credentials.newPassword} onChange={(event) => setCredentials((current) => ({ ...current, newPassword: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
          </div>
          <button disabled={busy} onClick={updateCredentials} className="mt-4 rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Update admin login</button>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-800">Step 2</p><h2 className="mt-1 text-xl font-bold">Set winner status and prize details</h2><p className="mt-1 text-sm text-slate-600">Select one code or several, then enter the message shown for that result.</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900">{selected.length} selected</span></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <select value={prize.outcome} onChange={(e) => setPrize({ outcome: e.target.value, prize: "", description: "" })} className="rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Choose result</option><option value="winner">Winner</option><option value="not_winner">Not a winner</option></select>
            {prize.outcome === "winner" && <>
              <input value={prize.prize} onChange={(e) => setPrize({ ...prize, prize: e.target.value })} aria-label="Prize title" className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Prize title" />
              <input value={prize.description} onChange={(e) => setPrize({ ...prize, description: e.target.value })} aria-label="Prize message" className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Prize message" />
            </>}
            {prize.outcome === "not_winner" && <input value={prize.description} onChange={(e) => setPrize({ ...prize, description: e.target.value })} aria-label="Try again message" className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Try again message" />}
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || !selected.length} onClick={savePrize} className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">Save prize details</button>{editingId && <button onClick={() => { setSelected([]); setEditingId(null); setPrize(blankPrize); }} className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold">Clear selection</button>}<button disabled={busy || !selected.length} onClick={downloadSelected} className="rounded-lg border border-blue-800 px-5 py-2.5 font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50">Download selected QR ZIP</button></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-800">Library</p><h2 className="mt-1 text-xl font-bold">All prize QR codes</h2><p className="text-sm text-slate-500">Select codes for a ZIP, preview them here, or download a single PNG.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Filter by ID or prize" /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3"><input type="checkbox" aria-label="Select visible codes" checked={Boolean(visibleCodes.length && visibleCodes.every((code) => selected.includes(code.id)))} onChange={selectVisible} /></th><th className="p-3">QR</th><th className="p-3">Prize ID</th><th className="p-3">Ticket status</th><th className="p-3">Outcome</th><th className="p-3">Prize</th><th className="p-3">Details</th><th className="p-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{visibleCodes.map((code) => <tr key={code.id} className={selected.includes(code.id) ? "bg-blue-50" : "hover:bg-slate-50"}>
              <td className="p-3"><input type="checkbox" checked={selected.includes(code.id)} onChange={() => toggle(code.id)} aria-label={`Select QR ${code.id}`} /></td>
              <td className="p-2"><img src={`${API_ORIGIN}${code.qr_path || `/qrcodes/qrcode_${code.id}.png`}`} alt={`QR code ${code.id}`} loading="lazy" className="h-20 w-20 rounded-lg border border-slate-200 bg-white object-contain p-1" /></td>
              <td className="p-3 font-bold">{code.id}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${code.used_at ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{code.used_at ? "Used" : "Unused"}</span>{code.used_at && <p className="mt-1 text-xs text-slate-500">{new Date(code.used_at).toLocaleString()}</p>}</td><td className="p-3 capitalize">{code.outcome?.replaceAll("_", " ") || <span className="text-slate-400">Not set</span>}</td><td className="p-3">{code.prize || <span className="text-slate-400">Not assigned</span>}</td><td className="max-w-xs p-3 text-slate-600">{[code.description, code.notes].filter(Boolean).join(" · ") || "—"}</td>
              <td className="p-3"><div className="flex gap-3"><button onClick={() => editCode(code)} className="font-semibold text-blue-800 hover:underline">Edit prize</button><button onClick={() => downloadOne(code.id)} className="font-semibold text-emerald-800 hover:underline">Download PNG</button></div></td>
            </tr>)}
            {!visibleCodes.length && <tr><td colSpan="8" className="p-12 text-center text-slate-500">No QR codes yet. Create an ID range above.</td></tr>}</tbody>
          </table></div>
        </section>
      </div>
    </main>
  );
}
