import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Html5QrcodeScanner } from "html5-qrcode";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

export default function ContestantPage() {
  const [contestant, setContestant] = useState(null);
  const [prizeId, setPrizeId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null);
  const scannerRef = useRef(null);
  const scanLock = useRef(false);


  const lookup = useCallback(async (value) => {
    if (scanLock.current) return;
    const id = String(value).trim();
    if (!/^\d+$/.test(id) || Number(id) < 1) {
      setMessage("Enter a valid prize ID or scan its QR code.");
      return;
    }
    scanLock.current = true;
    setLoading(true);
    setMessage("");
    setContestant(null);
    setPopup(null);
    try {
      const { data } = await axios.post(`${API_URL}/contestants/scan`, { contestantId: Number(id) });
      setContestant(data.contestant);
      setPrizeId(id);
      setPopup(data.contestant);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not find that prize ID.");
    } finally {
      setLoading(false);
      window.setTimeout(() => { scanLock.current = false; }, 900);
    }
  }, []);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    scanner.render((decodedText) => lookup(decodedText), () => {});
    scannerRef.current = scanner;
    return () => { scannerRef.current?.clear().catch(() => {}); };
  }, [lookup]);

  const handleSubmit = (event) => { event.preventDefault(); lookup(prizeId); };
  const hasPrize = Boolean(contestant?.prize);
  const isNotWinner = contestant?.outcome === "not_winner";
  const isWinner = contestant?.outcome === "winner" || (!contestant?.outcome && hasPrize);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-slate-100 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center"><p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-800">Prize reveal</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Check your prize</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">Scan the QR code on your ticket or enter its prize ID to see what it reveals.</p></header>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(420px,1.1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-7">
            <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-lg">▦</span><div><h2 className="text-xl font-bold">Scan your code</h2><p className="text-sm text-slate-500">Use your camera</p></div></div>
            <div id="qr-reader" className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50" />
            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />or enter the prize ID<span className="h-px flex-1 bg-slate-200" /></div>
            <form onSubmit={handleSubmit} className="flex gap-2"><input type="number" inputMode="numeric" min="1" value={prizeId} onChange={(event) => setPrizeId(event.target.value)} placeholder="Enter ID number" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /><button disabled={loading || !prizeId} className="rounded-xl bg-blue-800 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">{loading ? "Checking…" : "Reveal"}</button></form>
            {message && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}
          </section>

          <section aria-live="polite" className={`min-h-[350px] rounded-3xl border p-7 shadow-xl shadow-blue-950/5 sm:p-10 ${contestant ? (isWinner ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-100" : isNotWinner ? "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50" : "border-slate-200 bg-white") : "border-dashed border-slate-300 bg-white/70"}`}>
            {contestant ? <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className={`grid h-20 w-20 place-items-center rounded-full text-4xl ${isWinner ? "bg-amber-200 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{isWinner ? "★" : "↻"}</div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Prize ID {contestant.id}</p>
              <h2 className="mt-2 text-4xl font-black text-slate-950">{isWinner ? "Congratulations!" : isNotWinner ? "Not a winner this time" : "Thanks for taking part"}</h2>
              {isWinner ? <>
                <p className="mt-5 rounded-2xl bg-white/80 px-7 py-5 text-3xl font-extrabold text-amber-900 shadow-sm">{contestant.prize}</p>
                {contestant.description && <p className="mt-5 max-w-lg text-lg text-slate-700">{contestant.description}</p>}
              </> : isNotWinner ? <p className="mt-5 max-w-lg text-lg text-slate-700">{contestant.description}</p> : <p className="mt-3 text-slate-600">This code has no result set yet.</p>}
            </div> : <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><div className="grid h-20 w-20 place-items-center rounded-full bg-blue-50 text-3xl text-blue-800">?</div><h2 className="mt-6 text-2xl font-bold text-slate-900">Your result will appear here</h2><p className="mt-2 max-w-sm text-slate-500">Scan a code or enter the ID printed below it. Each code reveals its own prize.</p></div>}
          </section>
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">Prize details are linked to the ID printed on your QR ticket.</p>
      </div>
      {popup && <div role="dialog" aria-modal="true" aria-labelledby="result-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" onClick={() => setPopup(null)}><div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}><p className="text-xs font-bold uppercase tracking-widest text-blue-800">Ticket {popup.id} · Used</p><h2 id="result-title" className="mt-3 text-3xl font-black">{popup.outcome === "winner" ? "You won!" : "Try again"}</h2>{popup.outcome === "winner" && <p className="mt-4 text-2xl font-extrabold text-amber-800">{popup.prize}</p>}<p className="mt-3 text-lg text-slate-700">{popup.description}</p><button autoFocus onClick={() => setPopup(null)} className="mt-6 rounded-xl bg-blue-800 px-6 py-3 font-bold text-white">Close</button></div></div>}
    </main>
  );
}
