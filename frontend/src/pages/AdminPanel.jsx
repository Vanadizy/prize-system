// AdminPanel.jsx - The code below is the same as your last provided version,
// but included for completeness. It's ready to handle the new server logic.

import { useEffect, useState, useRef } from "react";
import axios from "axios";

export default function AdminPanel() {
  const [guests, setGuests] = useState([]);
  // [FIX] Initial total state can be 0 or null, but the calculation will use the array length.
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ fullname: "", phonenumber: "", sex: "", state: "" });
  const [searchPhone, setSearchPhone] = useState("");
  const [editingGuest, setEditingGuest] = useState(null);
  
  // NEW: State for status messages { type: 'success' | 'error', text: '...' }
  const [message, setMessage] = useState(null); 

  // NEW: Ref to target the form area for scrolling
  const formRef = useRef(null);

  // NOTE: Ensure your API_URL includes the correct IP and port.
  const API_URL = "https://guestsystem.onrender.com/api/guests";
  const sexOptions = ["Male", "Female"];
  const stateOptions = ["single", "double"];
  const roleOptions = ["guest", "reception", "drinks"];

  // Helper function to show a message, then clear it after 3 seconds
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchGuests = async () => {
    try {
      // [FIX] The server now returns { guests: [...] }, not { guests: [...], total: N }
      // The total must be derived from the length of the guests array.
      const token = localStorage.getItem('token'); // Retrieve token
      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}` // Add Authorization header
        }
      });
      
      const fetchedGuests = res.data.guests || [];
      setGuests(fetchedGuests);
      // [FIX] Calculate total from the fetched array length
      setTotal(fetchedGuests.length); 
    } catch (err) {
      // [FIX] Added better error handling for token/auth issues
      const errorMsg = err.response?.status === 401 || err.response?.status === 403 
        ? "Authentication failed. Please log in again." 
        : "Failed to fetch guests.";
      showMessage("error", errorMsg);
      console.error("Fetch guests error:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editingGuest) {
        // UPDATE Guest
        await axios.put(`${API_URL}/${editingGuest.id}`, form, { headers });
        setEditingGuest(null);
        showMessage("success", "Guest updated successfully!");
      } else {
        // ADD New Guest
        await axios.post(API_URL, form, { headers });
        showMessage("success", "Guest added successfully!");
      }
      setForm({ fullname: "", phonenumber: "", sex: "", state: "" });
      fetchGuests();
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Error occurred during submission.");
    }
  };

  const handleEdit = (guest) => {
    setEditingGuest(guest);
    setForm({ 
      fullname: guest.fullname || "", 
      phonenumber: guest.phonenumber || "", 
      sex: guest.sex || "", 
      state: guest.state || "" 
    });
    showMessage(null, null); // Clear existing messages
    
    // NEW: Scroll automatically to the form section
    if (formRef.current) {
      formRef.current.scrollIntoView({block: 'start' });
    }
  };

  const handleChange = e => {
      setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSearch = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (!searchPhone.trim()) return fetchGuests();
          
      const res = await axios.get(`${API_URL}/search?phonenumber=${searchPhone}`, { headers });
        
      // [FIX] Handle total count for search results as well
      const searchResults = res.data || [];
      setGuests(searchResults);
      setTotal(searchResults.length); 
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Error searching guests.");
    }
  };

  const updateRole = async (id, role) => {
    try {
//       const token = localStorage.getItem('token');
//       const headers = { Authorization: `Bearer ${token}` };
      // This API call now triggers the new user management logic in server.js
      await axios.put(`${API_URL}/${id}/role`, { role }, { headers });
      showMessage("success", `Role updated to ${role} for guest ${id}.`);
      fetchGuests();
    } catch (err) {
      showMessage("error", "Failed to update role and user account.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this guest?")) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}/${id}`, { headers });
      showMessage("success", "Guest and associated user deleted successfully!");
      fetchGuests();
    } catch (err) {
      showMessage("error", "Failed to delete guest.");
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL guests?")) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}`, { headers });
      showMessage("success", "All guests and non-admin users deleted successfully!");
      fetchGuests();
    } catch (err) {
      showMessage("error", "Failed to delete all guests.");
    }
  };

  // [FIX] The original useEffect calls fetchGuests, which now correctly sets total.
  useEffect(() => { 
    fetchGuests(); 
  }, []);

  const styles = {
    // ... (Your existing styles remain unchanged)
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
    },
    // NEW: Styles for message box
    messageBox: (type) => ({
      padding: '1rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      fontWeight: 'bold',
      backgroundColor: type === 'success' ? '#d1fae5' : '#fee2e2',
      color: type === 'success' ? '#065f46' : '#991b1b',
      border: `1px solid ${type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
      textAlign: 'center'
    })
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Admin Dashboard</h1>
        <p style={{ fontSize: "1.1rem", opacity: 0.85 }}>Manage guests, roles, and search records efficiently.</p>
        <h3>Total Guests: {total}</h3> {/* This now shows the correct count! */}
      </div>
      <div style={{ marginBottom: "2rem", textAlign: "right" }}>
        <a
          href="/register"
          style={{
            ...styles.button,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.1rem"
          }}
        >
          <span style={{
            display: "inline-block",
            width: "1.5em",
            height: "1.5em",
            borderRadius: "50%",
            background: "#fff",
            color: "#2563eb",
            fontWeight: "bold",
            textAlign: "center",
            lineHeight: "1.5em",
            fontSize: "1.2em"
          }}>+</span>
          New Admin
        </a>
      </div>
      
      {/* NEW: Message Box */}
      {message && (
        <div style={styles.messageBox(message.type)}>
          {message.text}
        </div>
      )}
      
      {/* Add/Edit Form */}
      {/* NEW: Attach the ref here */}
      <div style={styles.card} ref={formRef}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
          {editingGuest ? "Edit Guest" : "Add New Guest"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              placeholder="Full Name"
              name="fullname"
              value={form.fullname}
              onChange={handleChange}
              required
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              placeholder="Phone Number"
              name="phonenumber"
              value={form.phonenumber}
              onChange={handleChange}
              required
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={styles.label}>Sex</label>
            <select
              style={styles.select}
              name="sex"
              value={form.sex}
              onChange={handleChange}
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
              name="state"
              value={form.state}
              onChange={handleChange}
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
            {editingGuest && (
              <button 
                type="button" 
                onClick={() => { setEditingGuest(null); setForm({ fullname: "", phonenumber: "", sex: "", state: "" }); }}
                style={{ ...styles.button, background: "#64748b", marginLeft: "0.5rem" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Search Section */}
      <div style={styles.card}>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <input
            style={{...styles.input, flexGrow: 1}} // Adjusted style for better layout
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
                      // NEW: Calls handleEdit which scrolls the view
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