import { useEffect, useState } from "react";
import axios from "axios";

export default function AdminPanel() {
  const [guests, setGuests] = useState([]);
  const [form, setForm] = useState({ fullname: "", phonenumber: "", sex: "", state: "" });
  const [searchPhone, setSearchPhone] = useState("");
  const [editingGuest, setEditingGuest] = useState(null);

  const API_URL = "http://localhost:5000/api/guests";
  const sexOptions = ["Male", "Female"];
  const stateOptions = ["single", "double"];
  const roleOptions = ["guest", "reception", "drinks"];

  const fetchGuests = async () => {
    const res = await axios.get(API_URL);
    setGuests(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingGuest) {
      await axios.put(`${API_URL}/${editingGuest.id}`, form);
      setEditingGuest(null);
    } else {
      await axios.post(API_URL, form);
    }
    setForm({ fullname: "", phonenumber: "", sex: "", state: "" });
    fetchGuests();
  };

  const handleEdit = (guest) => {
    setEditingGuest(guest);
    setForm({ ...guest });
  };

  const handleSearch = async () => {
    if (!searchPhone.trim()) return fetchGuests();
    const res = await axios.get(`${API_URL}/search?phonenumber=${searchPhone}`);
    setGuests(res.data);
  };

  const updateRole = async (id, role) => {
    await axios.put(`${API_URL}/${id}/role`, { role });
    fetchGuests();
  };

  useEffect(() => { fetchGuests(); }, []);

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      color: "#222",
      padding: "2rem",
      fontFamily: "Segoe UI, Arial, sans-serif"
    },
    header: {
      background: "#2563eb",
      color: "#fff",
      borderRadius: "12px",
      padding: "1.5rem 2rem",
      marginBottom: "2rem",
      boxShadow: "0 2px 8px rgba(37,99,235,0.12)"
    },
    card: {
      background: "#fff",
      color: "#222",
      borderRadius: "12px",
      padding: "2rem",
      marginBottom: "2rem",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
    },
    button: {
      background: "linear-gradient(90deg, #2563eb, #1e40af)",
      color: "#fff",
      border: "none",
      padding: "0.5rem 1.2rem",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "1rem",
      transition: "background 0.2s"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: "1rem",
      fontSize: "1rem"
    },
    th: {
      background: "#2563eb",
      color: "#fff",
      padding: "0.75rem",
      borderBottom: "2px solid #e5e7eb",
      textAlign: "left"
    },
    td: {
      borderBottom: "1px solid #e5e7eb",
      padding: "0.75rem",
      textAlign: "left"
    },
    input: {
      padding: "0.5rem 1rem",
      borderRadius: "6px",
      border: "1px solid #cbd5e1",
      marginRight: "1rem",
      marginBottom: "1rem",
      fontSize: "1rem",
      width: "calc(100% - 2rem)"
    },
    select: {
      padding: "0.5rem",
      borderRadius: "6px",
      border: "1px solid #cbd5e1",
      fontSize: "1rem"
    },
    label: {
      fontWeight: 500,
      marginBottom: "0.25rem",
      display: "block"
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Admin Dashboard</h1>
        <p style={{ fontSize: "1.1rem", opacity: 0.85 }}>Manage guests, roles, and search records efficiently.</p>
      </div>

      {/* Add/Edit Form */}
      <div style={styles.card}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
          {editingGuest ? "Edit Guest" : "Add New Guest"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              placeholder="Full Name"
              value={form.fullname}
              onChange={e => setForm({ ...form, fullname: e.target.value })}
              required
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              placeholder="Phone Number"
              value={form.phonenumber}
              onChange={e => setForm({ ...form, phonenumber: e.target.value })}
              required
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={styles.label}>Sex</label>
            <select
              style={styles.select}
              value={form.sex}
              onChange={e => setForm({ ...form, sex: e.target.value })}
              required
            >
              <option value="">Select Sex</option>
              {sexOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={styles.label}>State</label>
            <select
              style={styles.select}
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
              required
            >
              <option value="">Select State</option>
              {stateOptions.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button style={styles.button} type="submit">
              {editingGuest ? "Update" : "Add Guest"}
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div style={styles.card}>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <input
            style={styles.input}
            placeholder="Search by phone number"
            value={searchPhone}
            onChange={e => setSearchPhone(e.target.value)}
          />
          <button style={styles.button} type="submit">Search</button>
        </form>
      </div>

      {/* Guests Table */}
      <div style={styles.card}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Guest List</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Fullname</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Sex</th>
              <th style={styles.th}>State</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {guests.map(g => (
              <tr key={g.id}>
                <td style={styles.td}>{g.fullname}</td>
                <td style={styles.td}>{g.phonenumber}</td>
                <td style={styles.td}>{g.sex}</td>
                <td style={styles.td}>{g.state}</td>
                <td style={styles.td}>
                  <select
                    style={styles.select}
                    value={g.role}
                    onChange={e => updateRole(g.id, e.target.value)}
                  >
                    {roleOptions.map(opt => (
                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => handleEdit(g)}
                    style={{ ...styles.button, background: "linear-gradient(90deg, #22c55e, #16a34a)", marginLeft: "0.5rem" }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer style={{ textAlign: "center", marginTop: "2rem", opacity: 0.7, fontSize: "1rem" }}>
        Developed by vanadizy
      </footer>
    </div>
  );
}
