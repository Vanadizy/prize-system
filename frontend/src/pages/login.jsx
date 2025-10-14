import React, { useState } from 'react';

const styles = {
    // ...same styles as before
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Arial, sans-serif',
    },
    card: {
        background: 'rgba(255,255,255,0.95)',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 8px 32px 0 rgba(44, 62, 80, 0.2)',
        minWidth: '320px',
        maxWidth: '90vw',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    title: {
        color: '#1e3c72',
        fontWeight: 700,
        fontSize: '2rem',
        textAlign: 'center',
        marginBottom: '0.5rem',
    },
    input: {
        padding: '0.75rem',
        borderRadius: '8px',
        border: '1px solid #2a5298',
        fontSize: '1rem',
        outline: 'none',
        marginBottom: '1rem',
        transition: 'border-color 0.2s',
    },
    button: {
        background: 'linear-gradient(90deg, #1e3c72 0%, #2a5298 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '0.75rem',
        fontWeight: 600,
        fontSize: '1rem',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    footer: {
        marginTop: '2rem',
        color: '#fff',
        fontSize: '1rem',
        textAlign: 'center',
        opacity: 0.8,
    },
    error: {
        color: '#e74c3c',
        fontSize: '0.95rem',
        textAlign: 'center',
        marginBottom: '0.5rem',
    },
    success: {
        color: '#27ae60',
        fontSize: '0.95rem',
        textAlign: 'center',
        marginBottom: '0.5rem',
    },
};

function LoginPage() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
        setSuccess('');
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!form.username || !form.password) {
            setError('Please enter both username and password.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('https://guest-system-backend.onrender.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(form),
            });
            
            const data = await res.json();
            if (!res.ok) {
                setError(data.message);
            } else {
                setSuccess(data.message);
                // Save token to localStorage/sessionStorage if needed
                localStorage.setItem('token', data.token);
                // Optionally redirect or update app state here
                if (data.user.role === 'reception') {
                    window.location.href = '/reception';
                } else if (data.user.role === 'drinks') {
                    window.location.href = '/drinks';
                } else if (data.user.role === 'admin') {
                    window.location.href = '/admin';
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <form style={styles.card} onSubmit={handleSubmit}>
                <div style={styles.title}>Login</div>
                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.success}>{success}</div>}
                <input
                    style={styles.input}
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange}
                    autoComplete="username"
                    disabled={loading}
                />
                <input
                    style={styles.input}
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    disabled={loading}
                />
                <button style={styles.button} type="submit" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>
            <footer style={styles.footer}>
                Developed by vanadizy
            </footer>
        </div>
    );
}

export default LoginPage;