import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { Calendar } from "lucide-react";

export function Tickets() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const limit = 25;

  useEffect(() => {
    let active = true;
    async function fetchTickets() {
      setLoading(true);
      try {
        const offset = (page - 1) * limit;
        const data = await api.getTickets(
          statusFilter,
          undefined, // priority
          searchTerm,
          limit,
          offset,
          startDate || undefined,
          endDate || undefined
        );
        if (active) {
          setTickets(data.tickets || []);
          setTotalCount(data.total || 0);
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
  }, [statusFilter, searchTerm, page, startDate, endDate]);

  const handleFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  const filteredTickets = tickets;

  const statuses = [
    { key: "ALL", label: "All Tickets" },
    { key: "ASSIGNED", label: "Assigned" },
    { key: "INITIAL_VISIT_COMPLETED", label: "Visited" },
    { key: "MATERIAL_REQUESTED", label: "Material Req" },
    { key: "INSURANCE_SUBMITTED", label: "Insurance" },
    { key: "ON_HOLD", label: "On Hold" },
    { key: "OUT_OF_SCOPE", label: "Out of Scope" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "MANUAL_ASSIGNMENT_REQUIRED", label: "Manual Assign" }
  ];

  if (loading && tickets.length === 0) {
    return <div style={styles.loading}>Loading Tickets Registry...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Tickets Registry</h1>
          <div style={{ fontSize: "0.78rem", color: "#64748B", marginTop: "2px" }}>
            Search, filter by date, engineer name, or ticket status
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <input 
            type="text" 
            placeholder="Search by Ticket ID, Customer, Engineer Name..." 
            className="form-input"
            style={styles.searchBar}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#F8FAFC", padding: "0.35rem 0.65rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <Calendar size={15} color="var(--primary)" />
            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569" }}>Date:</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="form-input"
              style={{ padding: "0.25rem 0.45rem", fontSize: "0.78rem", width: "130px" }}
            />
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>to</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="form-input"
              style={{ padding: "0.25rem 0.45rem", fontSize: "0.78rem", width: "130px" }}
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
                className="btn-secondary"
                style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterBar}>
        {statuses.map((s) => (
          <button
            key={s.key}
            className={`filter-pill ${statusFilter === s.key ? "filter-pill-active" : ""}`}
            onClick={() => handleFilterChange(s.key)}
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
                      <td style={{ fontWeight: "600", color: "var(--text-main)" }}>{t.ticketNumber}</td>
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

      {/* Pagination Footer */}
      <div style={styles.pagination}>
        <button 
          className="btn-secondary" 
          disabled={page <= 1} 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          style={styles.pageBtn}
        >
          Previous
        </button>
        <span style={styles.pageInfo}>
          Page {page} of {Math.ceil(totalCount / limit) || 1} (Total: {totalCount} records)
        </span>
        <button 
          className="btn-secondary" 
          disabled={page >= (Math.ceil(totalCount / limit) || 1)} 
          onClick={() => setPage(p => Math.min(Math.ceil(totalCount / limit) || 1, p + 1))}
          style={styles.pageBtn}
        >
          Next
        </button>
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
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "1.5rem",
    padding: "1rem 1.5rem",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px"
  },
  pageBtn: {
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    borderRadius: "6px"
  },
  pageInfo: {
    color: "var(--text-muted)",
    fontSize: "0.85rem",
    fontFamily: "var(--font-mono)"
  }
};
