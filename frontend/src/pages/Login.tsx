import React, { useState } from "react";
import { api } from "../utils/api";
import { KeyRound, Mail, AlertCircle, Compass } from "lucide-react";

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

  const handleQuickFill = (role: "admin" | "engineer") => {
    if (role === "admin") {
      setEmail("admin@claro.com");
      setPassword("admin123");
    } else {
      setEmail("engineer@claro.com");
      setPassword("engineer123");
    }
    setError(null);
  };

  return (
    <div style={styles.container}>
      <div className="panel-card" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Compass size={28} color="var(--primary)" />
          </div>
          <h1 style={styles.title}>CLARO O&M V2</h1>
          <p style={styles.subtitle}>Solar Operations Management & Performance Hub</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} color="var(--color-manual)" />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label" style={styles.label}>
              <Mail size={14} style={{ marginRight: "6px", display: "inline" }} />
              Operational Email
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. admin@claro.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={styles.label}>
              <KeyRound size={14} style={{ marginRight: "6px", display: "inline" }} />
              Security Password
            </label>
            <input
              type="password"
              className="form-input"
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

        <div style={styles.quickFillContainer}>
          <p style={styles.quickFillTitle}>Quick Developer Sandbox Access:</p>
          <div style={styles.quickFillButtons}>
            <button
              onClick={() => handleQuickFill("admin")}
              style={{ ...styles.quickBtn, borderColor: "var(--primary)", color: "var(--primary)" }}
              disabled={loading}
            >
              Role: System Admin
            </button>
            <button
              onClick={() => handleQuickFill("engineer")}
              style={{ ...styles.quickBtn, borderColor: "var(--color-assigned)", color: "var(--color-assigned)" }}
              disabled={loading}
            >
              Role: Field Engineer
            </button>
          </div>
        </div>
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
    backgroundColor: "var(--bg-primary)",
    padding: "1rem"
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    padding: "2.5rem 2rem",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0,0,0,0.1)",
    backgroundColor: "var(--bg-card)",
    borderRadius: "20px"
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "2rem"
  },
  logoBadge: {
    width: "60px",
    height: "60px",
    borderRadius: "16px",
    backgroundColor: "var(--bg-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 1rem auto",
    border: "1px solid var(--border-color)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
  },
  title: {
    fontFamily: "var(--font-title)",
    fontSize: "1.75rem",
    fontWeight: "700",
    color: "var(--text-main)",
    letterSpacing: "0.02em"
  },
  subtitle: {
    fontSize: "0.85rem",
    color: "var(--text-muted)",
    marginTop: "0.4rem",
    lineHeight: "1.4"
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem"
  },
  label: {
    display: "flex",
    alignItems: "center"
  },
  submitBtn: {
    width: "100%",
    padding: "0.85rem",
    fontSize: "0.95rem",
    fontWeight: "600",
    marginTop: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 1rem",
    backgroundColor: "hsla(355, 85%, 45%, 0.08)",
    border: "1px solid hsla(355, 85%, 45%, 0.15)",
    borderRadius: "8px",
    marginBottom: "1.25rem"
  },
  errorText: {
    fontSize: "0.82rem",
    color: "var(--color-manual)",
    fontWeight: "500"
  },
  quickFillContainer: {
    marginTop: "2rem",
    borderTop: "1px dashed var(--border-color)",
    paddingTop: "1.5rem",
    textAlign: "center" as const
  },
  quickFillTitle: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "0.75rem"
  },
  quickFillButtons: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center"
  },
  quickBtn: {
    backgroundColor: "var(--bg-card)",
    border: "1px solid",
    borderRadius: "8px",
    padding: "0.4rem 0.8rem",
    fontSize: "0.75rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "var(--transition-smooth)"
  }
};
