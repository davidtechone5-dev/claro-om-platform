import React, { useState } from "react";
import { api } from "../utils/api";
import { KeyRound, Mail, AlertCircle } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.login(email, password);
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={styles.container}>
      <div className="panel-card" style={styles.card}>
        <div style={styles.header}>
          {/* Official Claro Energy Brand Logo Badge */}
          <div className="claro-logo-badge" style={{ margin: "0 auto 1.25rem auto" }}>
            <div className="claro-logo-top">
              <span className="claro-logo-top-text">CLARO<sup>®</sup></span>
            </div>
            <div className="claro-logo-bottom">
              <span className="claro-logo-bottom-text">ENERGY</span>
            </div>
          </div>

          <h1 style={styles.title}>O&M Platform V2</h1>
          <p style={styles.subtitle}>Solar Operations Management & Performance Hub</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} color="#DC2626" />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <Mail size={15} color="#64748B" />
              <span>Operational Email</span>
            </label>
            <input
              type="email"
              className="form-input"
              style={styles.input}
              placeholder="e.g. admin@claro.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <KeyRound size={15} color="#64748B" />
              <span>Security Password</span>
            </label>
            <input
              type="password"
              className="form-input"
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Verifying Credentials..." : "Authenticate Securely"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100vw",
    backgroundColor: "#F8FAFC",
    padding: "1.5rem"
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "2.5rem 2rem",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04)",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #E2E8F0"
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "1.75rem"
  },
  title: {
    fontFamily: "var(--font-title)",
    fontSize: "1.6rem",
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: "-0.02em"
  },
  subtitle: {
    fontSize: "0.83rem",
    color: "#64748B",
    marginTop: "0.3rem",
    lineHeight: "1.4"
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.25rem"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem"
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.82rem",
    fontWeight: "700",
    color: "#334155"
  },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    border: "1px solid #CBD5E1",
    borderRadius: "8px"
  },
  submitBtn: {
    width: "100%",
    padding: "0.8rem",
    fontSize: "0.95rem",
    fontWeight: "700",
    backgroundColor: "#E52320",
    color: "#FFFFFF",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    marginTop: "0.5rem"
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 1rem",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FCA5A5",
    borderRadius: "8px",
    marginBottom: "1.25rem"
  },
  errorText: {
    fontSize: "0.82rem",
    color: "#DC2626",
    fontWeight: "600"
  }
};
