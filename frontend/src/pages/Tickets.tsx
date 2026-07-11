import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export function Tickets() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    let active = true;
    async function fetchTickets() {
      try {
        const data = await api.getTickets(
          statusFilter,
          undefined, // priority
          searchTerm,
          250 // limit to 250 rows for fast load times
        );
        if (active) {
          setTickets(data.tickets || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    
    const timer = setTimeout(() => {
      fetchTickets();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [statusFilter, searchTerm]);

  const filteredTickets = tickets;

  const statuses = [
    { key: "ALL", label: "All Tickets" },
    { key: "OPEN", label: "Active" },
    { key: "RECEIVED", label: "Received" },
    { key: "ASSIGNED", label: "Assigned" },
    { key: "INITIAL_VISIT_COMPLETED", label: "Visited" },
    { key: "MATERIAL_REQUESTED", label: "Material Req" },
    { key: "INSURANCE_SUBMITTED", label: "Insurance" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "MANUAL_ASSIGNMENT_REQUIRED", label: "Manual Assign" }
  ];

  if (loading) {
    return <div style={styles.loading}>Loading Tickets Registry...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Tickets Registry</h1>
        <input 
          type="text" 
          placeholder="Search by Ticket ID, Customer, or Application ID..." 
          className="form-input"
          style={styles.searchBar}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterBar}>
        {statuses.map((s) => (
          <button
            key={s.key}
            style={{
              ...styles.filterBtn,
              ...(statusFilter === s.key ? styles.filterBtnActive : {})
            }}
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="panel-card" style={{ padding: "0" }}>
        <div className="custom-table-container" style={{ margin: "0", border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Application ID</th>
                <th>Client Name</th>
                <th>Priority</th>
                <th>Location</th>
                <th>Status</th>
                <th>Assigned Engineer</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No matching tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const assignment = t.assignments?.[0];
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => navigate(`/tickets/${t.id}`, { state: { ticket: t } })}
                    >
                      <td style={{ fontWeight: "600", color: "#fff" }}>{t.ticketNumber}</td>
                      <td style={{ fontFamily: "monospace" }}>{t.complaint?.applicationId}</td>
                      <td>{t.complaint?.complainantName}</td>
                      <td>
                        <span style={t.priority === "CRITICAL" ? { color: "var(--color-manual)", fontWeight: "600" } : {}}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {t.complaint?.masterInstallation?.state?.name}, {t.complaint?.masterInstallation?.district?.name}
                      </td>
                      <td>
                        <span className={`status-badge status-${t.status.toLowerCase().split("_")[0]}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        {assignment ? (
                          <div style={styles.engBadge}>
                            <div style={styles.dot}></div>
                            {assignment.engineer?.name}
                          </div>
                        ) : (
                          <span style={{ color: "var(--color-manual)", fontSize: "0.85rem", fontWeight: "500" }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
  searchBar: {
    width: "360px"
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    marginBottom: "1.5rem"
  },
  filterBtn: {
    padding: "0.5rem 1rem",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    color: "var(--text-muted)",
    fontSize: "0.8rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "var(--transition-smooth)"
  },
  filterBtnActive: {
    backgroundColor: "var(--primary)",
    color: "#fff",
    borderColor: "var(--primary)"
  },
  engBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.85rem"
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "var(--accent)"
  }
};
