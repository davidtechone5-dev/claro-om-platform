import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { ArrowLeft, ShieldAlert, MapPin, Phone, User, Clock } from "lucide-react";

export function TicketDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<any>(location.state?.ticket || null);
  const [loading, setLoading] = useState(!ticket);

  useEffect(() => {
    async function loadData() {
      try {
        if (!ticket && id) {
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

  // Location fields extraction
  const metadata = ticket.metadata || ticket.complaint?.metadata || {};
  const stateName = ticket.complaint?.masterInstallation?.state?.name || metadata["State"] || metadata["STATE"] || "N/A";
  const districtName = ticket.complaint?.masterInstallation?.district?.name || metadata["District"] || metadata["DISTRICT"] || "N/A";
  const blockName = metadata["Block"] || metadata["TEHSIL"] || metadata["Block Name"] || "—";
  const villageName = metadata["Village"] || metadata["VILLAGE"] || metadata["Gram Panchayat"] || "—";
  const addressStr = ticket.complaint?.masterInstallation?.address || metadata["Address"] || metadata["Site Location"] || metadata["Location"] || `${villageName}, ${blockName}, ${districtName}, ${stateName}`;

  // Google Maps Search Query URL
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addressStr}, ${districtName}, ${stateName}`)}`;

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
        <div>
          <h1 className="page-title" style={{ fontSize: "1.6rem", fontWeight: "800", color: "#0F172A" }}>
            Ticket Details: <span style={{ color: "#E52320" }}>{ticket.ticketNumber}</span>
          </h1>
          <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "4px" }}>
            Application ID: <strong style={{ fontFamily: "monospace", color: "#0F172A" }}>{ticket.complaint?.applicationId}</strong>
          </div>
        </div>
        <span className={`status-badge status-${ticket.status.toLowerCase().split("_")[0]}`}>
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* PROMINENT AUTOMATIC LOCATION BANNER */}
      <div className="panel-card" style={styles.locationBannerCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <div style={styles.locationIconBox}>
              <MapPin size={26} color="#FFFFFF" />
            </div>
            <div>
              <div style={styles.locationTag}>AUTOMATICALLY LOGGED LOCATION</div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
                {districtName}, {stateName}
              </h2>
              <p style={{ fontSize: "0.9rem", color: "#334155", marginTop: "4px", lineHeight: "1.4" }}>
                <strong>Full Site Address:</strong> {addressStr}
              </p>
              
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.83rem", color: "#475569" }}>
                <div><strong>Block/Tehsil:</strong> {blockName}</div>
                <div><strong>Village/Panchayat:</strong> {villageName}</div>
              </div>
            </div>
          </div>

          <a 
            href={googleMapsUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={styles.googleMapsBtn}
          >
            <MapPin size={16} />
            Open in Google Maps ↗
          </a>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left Column: Complaint & Location info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Customer & Complainant Details */}
          <div className="panel-card">
            <h3 style={styles.cardTitle}>Client & Contact Info</h3>
            <div style={styles.detailsGrid}>
              <div>
                <label style={styles.detailLabel}>Complainant / Farmer Name</label>
                <div style={{ ...styles.detailVal, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <User size={15} color="#64748B" />
                  <span>{ticket.complaint?.complainantName || "N/A"}</span>
                </div>
              </div>

              <div>
                <label style={styles.detailLabel}>Contact Phone Number</label>
                <div style={styles.detailVal}>
                  {ticket.complaint?.complainantPhone ? (
                    <a href={`tel:${ticket.complaint.complainantPhone}`} style={{ color: "#2563EB", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "700" }}>
                      <Phone size={15} />
                      {ticket.complaint.complainantPhone}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>

              <div>
                <label style={styles.detailLabel}>State & District</label>
                <div style={styles.detailVal}>
                  {stateName}, {districtName}
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
                <div style={{ ...styles.detailVal, fontWeight: "700" }}>{ticket.complaint?.complaintType || "General"}</div>
              </div>
              <div>
                <label style={styles.detailLabel}>Priority SLA Level</label>
                <div style={{ ...styles.detailVal, color: ticket.priority === "CRITICAL" ? "#DC2626" : ticket.priority === "URGENT" ? "#D97706" : "#2563EB", fontWeight: "800" }}>
                  {ticket.priority}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={styles.detailLabel}>Complaint Log Description</label>
                <div style={{ ...styles.detailVal, whiteSpace: "pre-wrap", lineHeight: "1.6", backgroundColor: "#F8FAFC", padding: "0.8rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  {ticket.complaint?.description || "No description provided."}
                </div>
              </div>
            </div>
          </div>

          {/* Spreadsheet Reference Fields */}
          {Object.keys(metadata).length > 0 && (
            <div className="panel-card">
              <h3 style={styles.cardTitle}>Synced Row Fields</h3>
              <div style={{ ...styles.detailsGrid, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {Object.entries(metadata)
                  .filter(([key]) => !["__row_number", "__sheet_name", "Ticket ID", "Live Stage", "Sync Status", "Sync Error"].includes(key))
                  .map(([key, val]: any) => (
                    <div key={key} style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: "0.5rem" }}>
                      <label style={styles.detailLabel}>{key}</label>
                      <div style={styles.detailVal}>{val?.toString() || "—"}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Assignment Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Active Assignment Status */}
          <div className="panel-card">
            <h3 style={styles.cardTitle}>Field Engineer Assignment</h3>
            {activeAssignment ? (
              <div style={styles.assignmentDetails}>
                <div style={styles.assignmentRow}>
                  <strong style={{ color: "#64748B" }}>Engineer Name:</strong> <span style={{ fontWeight: "700", color: "#0F172A" }}>{activeAssignment.engineer?.name}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong style={{ color: "#64748B" }}>Phone:</strong> <span style={{ fontWeight: "600", color: "#2563EB" }}>{activeAssignment.engineer?.phone}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong style={{ color: "#64748B" }}>Email:</strong> <span>{activeAssignment.engineer?.email}</span>
                </div>
                <div style={styles.assignmentRow}>
                  <strong style={{ color: "#64748B" }}>Assigned At:</strong> <span>{new Date(activeAssignment.assignedAt).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div style={styles.unassignedAlert}>
                <ShieldAlert size={20} />
                <span>Ticket is unassigned. Assigned via Google Sheet sync.</span>
              </div>
            )}
          </div>

          {/* SLA Turnaround Info */}
          <div className="panel-card" style={styles.slaPanel}>
            <Clock size={22} color="#E52320" />
            <div>
              <h4 style={{ color: "#0F172A", fontSize: "0.95rem", fontWeight: "700" }}>SLA Target Response Window</h4>
              <p style={{ color: "#64748B", fontSize: "0.83rem", marginTop: "0.25rem", lineHeight: "1.4" }}>
                Priority: <strong style={{ color: "#E52320" }}>{ticket.priority}</strong>.
                Standard Target: Critical &lt; 24h, Urgent &lt; 48h, Normal &lt; 72h.
              </p>
            </div>
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
    color: "#64748B",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontFamily: "var(--font-title)",
    fontWeight: "600",
    marginBottom: "1rem",
    transition: "var(--transition-smooth)"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "1.5rem"
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: "800",
    color: "#0F172A",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "0.6rem",
    marginBottom: "1rem"
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.2rem"
  },
  detailLabel: {
    fontSize: "0.72rem",
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "0.25rem"
  },
  detailVal: {
    fontSize: "0.9rem",
    color: "#0F172A",
    fontWeight: "600"
  },
  locationBannerCard: {
    backgroundColor: "#FFFFFF",
    border: "2px solid #E2E8F0",
    borderLeft: "6px solid #E52320",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    marginBottom: "1.5rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
  },
  locationIconBox: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    backgroundColor: "#E52320",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  locationTag: {
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#E52320",
    letterSpacing: "0.08em"
  },
  googleMapsBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    backgroundColor: "#0F172A",
    color: "#FFFFFF",
    padding: "0.6rem 1.1rem",
    borderRadius: "8px",
    fontSize: "0.83rem",
    fontWeight: "700",
    textDecoration: "none",
    transition: "all 0.2s ease"
  },
  unassignedAlert: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FCA5A5",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    color: "#DC2626",
    fontSize: "0.85rem",
    fontWeight: "600"
  },
  assignmentDetails: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.6rem"
  },
  assignmentRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.88rem",
    borderBottom: "1px solid #F1F5F9",
    paddingBottom: "0.4rem"
  },
  slaPanel: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    borderLeft: "4px solid #E52320",
    backgroundColor: "#FFFFFF"
  }
};
