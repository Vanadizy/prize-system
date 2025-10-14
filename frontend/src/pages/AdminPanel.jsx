import { useEffect, useState } from "react";
import axios from "axios";

export default function AdminPanel() {
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ fullname: "", phonenumber: "", sex: "", state: "" });
  const [searchPhone, setSearchPhone] = useState("");
  const [editingGuest, setEditingGuest] = useState(null);

  const API_URL = "http://192.168.1.147:5000/api/guests";
  const sexOptions = ["Male", "Female"];
  const stateOptions = ["single", "double"];
  const roleOptions = ["guest", "reception", "drinks"];

  const fetchGuests = async () => {
    const res = await axios.get(API_URL);
    setGuests(res.data.guests);
    setTotal(res.data.total);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGuest) {
        await axios.put(`${API_URL}/${editingGuest.id}`, form);
        setEditingGuest(null);
      } else {
        await axios.post(API_URL, form);
      }
      setForm({ fullname: "", phonenumber: "", sex: "", state: "" });
      fetchGuests();
    } catch (err) {
      alert(err.response?.data?.message || "Error occurred");
    }
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this guest?")) return;
    await axios.delete(`${API_URL}/${id}`);
    fetchGuests();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL guests?")) return;
    await axios.delete(`${API_URL}`);
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
    tableWrapper: {
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: "1rem",
      fontSize: "1rem",
      minWidth: "600px"
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
      textAlign: "left",
      verticalAlign: "middle"
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
      {/* Header */}
      <div style={styles.header}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Admin Dashboard</h1>
        <p style={{ fontSize: "1.1rem", opacity: 0.85 }}>Manage guests, roles, and search records efficiently.</p>
        <h3>Total Guests: {total}</h3>
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

      {/* Search Section */}
      <div style={styles.card}>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <input
            style={styles.input}
            placeholder="Search by phone number"
            value={searchPhone}
            onChange={e => setSearchPhone(e.target.value)}
          />
          <button style={styles.button} type="submit">Search</button>
          <button
            style={{ ...styles.button, background: "linear-gradient(90deg, #dc2626, #b91c1c)" }}
            type="button"
            onClick={handleDeleteAll}
          >
            Delete All
          </button>
        </form>
      </div>

      {/* Guest Table */}
      <div style={styles.card}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Guest List</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Fullname</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Sex</th>
                <th style={styles.th}>State</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>QR Code</th>
                <th style={styles.th}>Actions</th>
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
                    <select style={styles.select} value={g.role} onChange={e => updateRole(g.id, e.target.value)}>
                      {roleOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    {g.qrcode ? (
                      <>
                        <img src={g.qrcode} alt="QR" width="70" height="70" style={{ borderRadius: "8px" }} />
                        <br />
                        <a
                          href={g.qrcode}
                          download={`QR_${g.fullname.replace(/\s+/g, "_")}.png`}
                          style={{
                            display: "inline-block",
                            marginTop: "5px",
                            textDecoration: "none",
                            background: "#2563eb",
                            color: "#fff",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.9rem"
                          }}
                        >
                          Download
                        </a>
                      </>
                    ) : "Pending"}
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleEdit(g)}
                      style={{ ...styles.button, background: "linear-gradient(90deg, #22c55e, #16a34a)", marginRight: "0.5rem" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      style={{ ...styles.button, background: "linear-gradient(90deg, #dc2626, #b91c1c)" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer style={{ textAlign: "center", marginTop: "2rem", opacity: 0.7, fontSize: "1rem" }}>
        Developed by vanadizy
      </footer>
    </div>
  );
}
