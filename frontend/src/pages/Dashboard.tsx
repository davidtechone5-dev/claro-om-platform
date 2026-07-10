import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { AlertCircle, CheckCircle, Truck, ShieldAlert } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    manual: 0,
    material: 0
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const data = await api.getTickets();
        const tickets = data.tickets || [];
        
        // Compute counts
        let openCount = 0;
        let resolvedCount = 0;
        let manualCount = 0;
        let materialCount = 0;

        tickets.forEach((t: any) => {
          if (t.status === "RESOLVED" || t.status === "CLOSED") {
            resolvedCount++;
          } else {
            openCount++;
          }
          if (t.status === "MANUAL_ASSIGNMENT_REQUIRED") {
            manualCount++;
          }
          if (t.status === "MATERIAL_REQUESTED" || t.status === "MATERIAL_DISPATCHED") {
            materialCount++;
          }
        });

        setMetrics({
          total: data.total || tickets.length,
          open: openCount,
          resolved: resolvedCount,
          manual: manualCount,
          material: materialCount
        });

        setRecentTickets(tickets.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading Claro Operations Overview...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Operations Dashboard</h1>
        <button className="btn-primary" onClick={() => navigate("/tickets")}>
          View Tickets Registry
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={styles.kpiGrid}>
        <div className="panel-card" style={styles.kpiCard}>
          <div style={{ ...styles.iconBg, backgroundColor: "hsla(210, 100%, 50%, 0.15)" }}>
            <AlertCircle color="var(--color-received)" size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Total Active Tickets</div>
            <div style={styles.kpiVal}>{metrics.open}</div>
          </div>
        </div>

        <div className="panel-card" style={styles.kpiCard}>
          <div style={{ ...styles.iconBg, backgroundColor: "hsla(145, 80%, 40%, 0.15)" }}>
            <CheckCircle color="var(--color-resolved)" size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Resolved Tickets</div>
            <div style={styles.kpiVal}>{metrics.resolved}</div>
          </div>
        </div>

        <div className="panel-card" style={styles.kpiCard}>
          <div style={{ ...styles.iconBg, backgroundColor: "hsla(0, 85%, 55%, 0.15)" }}>
            <ShieldAlert color="var(--color-manual)" size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Manual Assign Queue</div>
            <div style={styles.kpiVal}>{metrics.manual}</div>
          </div>
        </div>

        <div className="panel-card" style={styles.kpiCard}>
          <div style={{ ...styles.iconBg, backgroundColor: "hsla(35, 100%, 50%, 0.15)" }}>
            <Truck color="var(--color-material)" size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Pending Materials</div>
            <div style={styles.kpiVal}>{metrics.material}</div>
          </div>
        </div>
      </div>

      {/* Recent Tickets Block */}
      <div style={styles.bottomSection}>
        <div className="panel-card" style={{ flexGrow: 1 }}>
          <h3 style={styles.sectionTitle}>Recent Incident Tickets</h3>
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Customer Name</th>
                  <th>State & District</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      No tickets loaded. Sync some Google Form entries first!
                    </td>
                  </tr>
                ) : (
                  recentTickets.map((t: any) => (
                    <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`, { state: { ticket: t } })}>
                      <td style={{ fontWeight: "600", color: "#fff" }}>{t.ticketNumber}</td>
                      <td>{t.complaint?.complainantName}</td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {t.complaint?.masterInstallation?.state?.name} ({t.complaint?.masterInstallation?.district?.name})
                      </td>
                      <td>
                        <span style={t.priority === "CRITICAL" ? { color: "var(--color-manual)", fontWeight: "600" } : {}}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${t.status.toLowerCase().split("_")[0]}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "80vh",
    fontFamily: "var(--font-title)",
    fontSize: "1.2rem",
    color: "var(--text-muted)"
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "1.5rem",
    marginBottom: "2.5rem"
  },
  kpiCard: {
    display: "flex",
    alignItems: "center",
    gap: "1.25rem"
  },
  iconBg: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  kpiLabel: {
    fontSize: "0.85rem",
    color: "var(--text-muted)",
    fontWeight: "500",
    marginBottom: "0.25rem"
  },
  kpiVal: {
    fontFamily: "var(--font-title)",
    fontSize: "1.75rem",
    fontWeight: "700",
    color: "#fff"
  },
  bottomSection: {
    display: "flex",
    gap: "1.5rem",
    marginTop: "1.5rem"
  },
  sectionTitle: {
    fontFamily: "var(--font-title)",
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#fff",
    marginBottom: "1rem"
  }
};
