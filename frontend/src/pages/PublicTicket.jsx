import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function parseTicketId(value) {
  const match = String(value ?? "").match(/^(?:QSN[\s_-]*)?(\d{1,5})$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return id >= 1 && id <= 9999 ? id : null;
}

function formatTicketId(value) {
  return `QSN ${String(value).padStart(5, "0")}`;
}

export default function PublicTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [logo, setLogo] = useState(null);
  const [used, setUsed] = useState(false);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    const id = parseTicketId(ticketId);
    if (!id) { setStatus("unknown"); return () => { active = false; }; }
    Promise.all([
      axios.get(`${API_URL}/public/contestants/${id}`),
      axios.get(`${API_URL}/public/branding`).catch(() => ({ data: { logoDataUrl: null } })),
    ]).then(([ticketResponse, brandingResponse]) => {
      if (!active) return;
      setTicket(ticketResponse.data.ticket);
      setUsed(ticketResponse.data.used);
      setLogo(brandingResponse.data.logoDataUrl);
      setStatus("ready");
    }).catch((error) => {
      if (!active) return;
      setStatus(error.response?.status === 404 ? "unknown" : "error");
    });
    return () => { active = false; };
  }, [ticketId]);

  const winner = ticket?.outcome === "winner";
  const heading = ticket?.display_label || (winner ? "LUCKY TICKET" : "JARIBU TENA");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,179,8,0.2),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(30,64,175,0.35),_transparent_50%)]" />
      <article className={`relative w-full max-w-xl overflow-hidden rounded-[2rem] border shadow-2xl ${winner && !used ? "border-amber-300/40 bg-gradient-to-b from-amber-950/75 via-slate-950 to-slate-950 shadow-amber-950/30" : "border-white/10 bg-gradient-to-b from-slate-800 to-slate-950 shadow-black/40"}`}>
        <div className={`h-2 w-full ${winner && !used ? "bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-500" : "bg-gradient-to-r from-blue-700 via-cyan-300 to-blue-700"}`} />
        <div className="px-7 py-10 text-center sm:px-12 sm:py-12">
          {logo && <img src={logo} alt="Campaign logo" className="mx-auto mb-8 h-24 max-w-52 object-contain" />}
          {status === "loading" ? <p className="py-24 text-slate-300">Loading ticket…</p> : null}
          {status === "unknown" && <><p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-300">Unknown ticket</p><h1 className="mt-4 text-3xl font-black">We couldn’t find this ticket</h1><p className="mt-3 text-slate-300">Check the printed code or contact the campaign administrator.</p></>}
          {status === "error" && <><p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-200">Temporarily unavailable</p><h1 className="mt-4 text-3xl font-black">Please try again</h1><p className="mt-3 text-slate-300">We couldn’t load this ticket right now.</p></>}
          {status === "ready" && used && <><p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-300">Ticket already used</p><h1 className="mt-4 text-3xl font-black">Already claimed</h1><p className="mt-3 text-slate-300">This ticket has already been used. If you need help, please contact an administrator.</p></>}
          {status === "ready" && !used && !ticket.outcome && <><p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-200">Result pending</p><h1 className="mt-4 text-3xl font-black">{formatTicketId(ticket.id)}</h1><p className="mt-3 text-slate-300">The administrator has not set this ticket’s result yet.</p></>}
          {status === "ready" && !used && <>
            {ticket.outcome && <><p className={`text-sm font-black uppercase tracking-[0.38em] ${winner ? "text-amber-200" : "text-cyan-200"}`}>{winner ? "WINNER" : "NOT WON"}</p>
            <h1 className="mt-5 text-2xl font-black uppercase tracking-wide sm:text-3xl">{heading}</h1>
            <p className="mt-2 text-xl font-bold tracking-[0.22em] text-white">{formatTicketId(ticket.id)}</p>
            {winner && ticket.prize && <p className="mx-auto mt-9 max-w-lg text-3xl font-black leading-tight text-amber-200 sm:text-4xl">{ticket.prize}</p>}
            {ticket.description && <p className="mx-auto mt-8 max-w-md whitespace-pre-wrap text-base font-semibold leading-relaxed text-slate-200 sm:text-lg">{ticket.description}</p>}</>}
          </>}
        </div>
      </article>
    </main>
  );
}
