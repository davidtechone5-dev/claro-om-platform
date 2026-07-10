import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { ArrowLeft, ShieldAlert, Calendar } from "lucide-react";

export function TicketDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Use state ticket passed in router navigation, or fetch
  const [ticket, setTicket] = useState<any>(location.state?.ticket || null);
  const [loading, setLoading] = useState(!ticket);

  useEffect(() => {
    async function loadData() {
      try {
        if (!ticket && id) {
          // If loaded directly via URL, get tickets and filter by id
          const data = await api.getTickets();
          const t = data.tickets?.find((item: any) => item.id === id);
          if (t) {
            setTicket(t);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, ticket]);

  const activeAssignment = ticket?.assignments?.[0];

  if (loading) {
    return <div style={styles.loading}>Loading ticket timeline details...</div>;
  }

  if (!ticket) {
    return (
      <div style={styles.loading}>
        <h3>Ticket not found.</h3>
        <button className="btn-secondary" onClick={() => navigate("/tickets")}>Back to Registry</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: "4rem" }}>
      {/* Back Button */}
      <button 
        style={styles.backBtn} 
        onClick={() => navigate("/tickets")}
      >
        <ArrowLeft size={16} />
        Back to Registry
      </button>

      <div className="page-header">
        <h1 className="page-title">
          Ticket Info: <span style={{ color: "#fff" }}>{ticket.ticketNumber}</span>
        </h1>
        <span className={`status-badge status-${ticket.status.toLowerCase().split("_")[0]}`}>
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>

      <div style={styles.grid}>
        {/* Left Column: Forms details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Customer & Installation Details */}
          <div className="panel-card">
            <h3 style={styles.cardTitle}>Client & Installation Info</h3>
            <div style={styles.detailsGrid}>
              <div>
                <label style={styles.detailLabel}>Client Name</label>
                <div style={styles.detailVal}>{ticket.complaint?.complainantName}</div>
              </div>
              <div>
                <label style={styles.detailLabel}>Application ID</label>
                <div style={{ ...styles.detailVal, fontFamily: "monospace" }}>
                  {ticket.complaint?.applicationId}
                </div>
              </div>
              <div>
                <label style={styles.detailLabel}>Phone Number</label>
                <div style={styles.detailVal}>{ticket.complaint?.complainantPhone}</div>
              </div>
              <div>
                <label style={styles.detailLabel}>Installation Location</label>
                <div style={styles.detailVal}>{ticket.complaint?.masterInstallation?.address || "N/A"}</div>
              </div>
              <div>
                <label style={styles.detailLabel}>State & District</label>
                <div style={styles.detailVal}>
                  {ticket.complaint?.masterInstallation?.state?.name}, {ticket.complaint?.masterInstallation?.district?.name}
                </div>
              </div>
              <div>
                <label style={styles.detailLabel}>Installation Date</label>
                <div style={styles.detailVal}>
                  {ticket.complaint?.masterInstallation?.installationDate 
                    ? new Date(ticket.complaint.masterInstallation.installationDate).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Incident Description */}
          <div className="panel-card">
            <h3 style={styles.cardTitle}>Incident Details</h3>
            <div style={styles.detailsGrid}>
              <div>
                <label style={styles.detailLabel}>Incident Category</label>
                <div style={styles.detailVal}>{ticket.complaint?.complaintType}</div>
              </div>
              <div>
                <label style={styles.detailLabel}>Priority SLA</label>
                <div style={styles.detailVal}>{ticket.priority}</div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={styles.detailLabel}>Complaint Log Description</label>
                <div style={{ ...styles.detailVal, whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                  {ticket.complaint?.description || "No description provided."}
                </div>
              </div>
            </div>
          </div>

          {/* SLA Warning */}
          <div className="panel-card" style={styles.slaPanel}>
            <Calendar size={20} color="var(--primary)" />
            <div>
              <h4 style={{ color: "#fff", fontSize: "0.95rem" }}>SLA Turnaround (TAT) Deadline</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                This is a **{ticket.priority}** ticket. 
                SLA targets: Critical = 24h, Urgent = 48h, Normal = 72h.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: Timeline & Assignment Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Active Assignment Status */}
          <div className="panel-card">
            <h3 style={styles.cardTitle}>Engineer Assignment</h3>
            {activeAssignment ? (
              <div style={styles.assignmentDetails}>
                <div style={styles.assignmentRow}>
                  <strong>Name:</strong> <span>{activeAssignment.engineer?.name}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong>Phone:</strong> <span>{activeAssignment.engineer?.phone}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong>Email:</strong> <span>{activeAssignment.engineer?.email}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong>Assigned:</strong> <span>{new Date(activeAssignment.assignedAt).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div style={styles.unassignedAlert}>
                <ShieldAlert size={20} />
                <span>Ticket is unassigned. Updates are managed from the Google Sheet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    height: "80vh",
    fontFamily: "var(--font-title)",
    fontSize: "1.2rem",
    color: "var(--text-muted)",
    gap: "1.5rem"
  },
  backBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontFamily: "var(--font-title)",
    fontWeight: "500",
    marginBottom: "1.5rem",
    transition: "var(--transition-smooth)"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "2rem"
  },
  cardTitle: {
    fontSize: "1.1rem",
    color: "#fff",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "0.75rem",
    marginBottom: "1.25rem"
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.25rem"
  },
  detailLabel: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "0.25rem"
  },
  detailVal: {
    fontSize: "0.95rem",
    color: "#fff",
    fontWeight: "500"
  },
  unassignedAlert: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    backgroundColor: "hsla(0, 85%, 55%, 0.1)",
    border: "1px solid var(--color-manual)",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    color: "var(--color-manual)",
    fontSize: "0.85rem",
    fontWeight: "500"
  },
  assignmentDetails: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem"
  },
  assignmentRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.9rem",
    borderBottom: "1px solid hsla(224, 40%, 20%, 0.5)",
    paddingBottom: "0.4rem"
  },
  slaPanel: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    borderLeft: "4px solid var(--primary)"
  },
  successBanner: {
    backgroundColor: "hsla(145, 80%, 40%, 0.15)",
    border: "1px solid var(--color-resolved)",
    color: "var(--color-resolved)",
    padding: "1rem",
    borderRadius: "10px",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
    fontWeight: "500"
  },
  errorBanner: {
    backgroundColor: "hsla(0, 85%, 55%, 0.15)",
    border: "1px solid var(--color-manual)",
    color: "var(--color-manual)",
    padding: "1rem",
    borderRadius: "10px",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
    fontWeight: "500"
  }
};
