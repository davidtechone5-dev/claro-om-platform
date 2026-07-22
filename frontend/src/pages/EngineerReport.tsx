import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../utils/api";
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  AlertCircle,
  Calendar
} from "lucide-react";

export function EngineerReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");

  useEffect(() => {
    async function loadReportData() {
      if (!id) return;
      try {
        setLoading(true);
        const stats = await api.getEngineerPerformance(id, startDate || undefined, endDate || undefined);
        setData(stats);
      } catch (err: any) {
        setError(err.message || "Failed to load engineer report data.");
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, [id, startDate, endDate]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <FileText className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ marginTop: "1rem" }}>Compiling Performance Audit Report...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={40} color="var(--color-manual)" />
        <h2>Audit Compilation Failed</h2>
        <p style={{ color: "var(--text-muted)", margin: "0.5rem 0 1.5rem 0" }}>{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { engineer, metrics, tickets } = data;
  const ratingLevel = metrics.performanceScore >= 90 ? "Excellent" : metrics.performanceScore >= 80 ? "Satisfactory" : "Under Watch / Action Required";
  const ratingColor = metrics.performanceScore >= 90 ? "var(--color-resolved)" : metrics.performanceScore >= 80 ? "var(--primary)" : "var(--color-manual)";

  const exportIndividualCSV = () => {
    if (!data || !data.tickets) return;
    const headers = [
      "Ticket ID",
      "Assigned Date",
      "Application ID",
      "Customer Name",
      "Complaint Type",
      "Priority",
      "Initial Visit Date",
      "Current Status",
      "Service Report Date",
      "TAT (Days)"
    ];

    const lines: string[] = [
      `"Claro Energy O&M - Engineer Assignment Audit Report"`,
      `"Engineer: ${engineer.name} (${engineer.state})"`,
      `"Date Range: ${startDate || "All"} to ${endDate || "All"}"`,
      `"Exported On: ${new Date().toLocaleString()}"`,
      "",
      headers.join(",")
    ];

    tickets.forEach((t: any) => {
      const assignedStr = t.assignedAt ? new Date(t.assignedAt).toISOString().split("T")[0] : "";
      const visitStr = t.initialVisitDate ? new Date(t.initialVisitDate).toISOString().split("T")[0] : "";
      const serviceStr = t.serviceReportDate ? new Date(t.serviceReportDate).toISOString().split("T")[0] : "";

      lines.push([
        `"${t.ticketNumber}"`,
        `"${assignedStr}"`,
        `"${t.complaint?.applicationId || ""}"`,
        `"${t.complaint?.complainantName || ""}"`,
        `"${t.complaint?.complaintType || ""}"`,
        `"${t.priority}"`,
        `"${visitStr}"`,
        `"${t.status}"`,
        `"${serviceStr}"`,
        t.tatDays !== null ? t.tatDays : ""
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Engineer_Assignment_Log_${engineer.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.wrapper}>
      {/* Back & Print Controls (Hidden on Print) */}
      <div className="no-print" style={styles.controlsBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => navigate("/engineers/overview")} className="btn-secondary" style={styles.controlBtn}>
            <ArrowLeft size={16} /> Engineers Overview
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fff", padding: "0.3rem 0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <Calendar size={14} color="var(--primary)" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => {
                const p = new URLSearchParams(searchParams);
                if (e.target.value) p.set("startDate", e.target.value);
                else p.delete("startDate");
                setSearchParams(p);
              }}
              style={{ border: "none", fontSize: "0.78rem", color: "#1e293b" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => {
                const p = new URLSearchParams(searchParams);
                if (e.target.value) p.set("endDate", e.target.value);
                else p.delete("endDate");
                setSearchParams(p);
              }}
              style={{ border: "none", fontSize: "0.78rem", color: "#1e293b" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={exportIndividualCSV} className="btn-secondary" style={styles.controlBtn}>
            Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary" style={styles.controlBtn}>
            <Printer size={16} /> Trigger Print Dialog
          </button>
        </div>
      </div>

      {/* Printable Sheet Area */}
      <div style={styles.sheet} className="print-sheet">
        {/* Report Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div className="claro-logo-badge" style={{ marginBottom: "0.5rem" }}>
              <div className="claro-logo-top">
                <span className="claro-logo-top-text">CLARO<sup>®</sup></span>
              </div>
              <div className="claro-logo-bottom">
                <span className="claro-logo-bottom-text">ENERGY</span>
              </div>
            </div>
            <h1 style={styles.reportTitle}>Engineer Ticket Assignment Audit Sheet</h1>
            <p style={styles.reportSubtitle}>Chronological Workload Log & Operational Scorecard</p>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.bioCell}>
              <span style={styles.bioLabel}>Active District:</span>
              <span style={styles.bioVal}>{engineer.district}</span>
            </div>
            <div style={styles.bioCell}>
              <span style={styles.bioLabel}>Account Status:</span>
              <span style={{ ...styles.bioVal, color: engineer.isActive ? "var(--color-resolved)" : "var(--color-manual)", fontWeight: "600" }}>
                {engineer.isActive ? "Active / Field-Deployed" : "Suspended / Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Scorecard KPIs Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionHeader}>2. Operational Metrics & Performance Score</h2>
          
          <div style={styles.kpiTableWrapper}>
            <table style={styles.kpiTable}>
              <thead>
                <tr>
                  <th style={styles.kpiTh}>Operational Indicator</th>
                  <th style={styles.kpiTh}>Target SLA</th>
                  <th style={styles.kpiTh}>Current Count</th>
                  <th style={styles.kpiTh}>Evaluation Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.kpiTd}>Total Assigned Tasks</td>
                  <td style={styles.kpiTd}>--</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600" }}>{metrics.totalTickets}</td>
                  <td style={styles.kpiTd}>Cumulative caseload</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Resolved Closed Cases</td>
                  <td style={styles.kpiTd}>Maximize</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-resolved)" }}>{metrics.totalResolved}</td>
                  <td style={styles.kpiTd}>Marked fully resolved</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Active Backlog Queue</td>
                  <td style={styles.kpiTd}>Minimize</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-material)" }}>{metrics.activeTickets}</td>
                  <td style={styles.kpiTd}>Requires urgent response</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Resolution Rate (%)</td>
                  <td style={styles.kpiTd}>&gt; 80%</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--primary)" }}>{metrics.resolutionRate}%</td>
                  <td style={{ 
                    ...styles.kpiTd, 
                    fontWeight: "600", 
                    color: metrics.resolutionRate >= 80 ? "var(--color-resolved)" : "var(--color-manual)" 
                  }}>
                    {metrics.resolutionRate >= 80 ? "SLA Met" : "SLA Breached"}
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Average Turn-Around-Time (TAT)</td>
                  <td style={styles.kpiTd}>&lt; 4.0 Days</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600" }}>{metrics.avgTat} Days</td>
                  <td style={{ 
                    ...styles.kpiTd, 
                    fontWeight: "600", 
                    color: metrics.avgTat <= 4 ? "var(--color-resolved)" : "var(--color-manual)" 
                  }}>
                    {metrics.avgTat <= 4 ? "SLA Met" : "SLA Breached"}
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>SLA Breach Incidents</td>
                  <td style={styles.kpiTd}>0 Cases</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-manual)" }}>{metrics.slaBreachedCount}</td>
                  <td style={styles.kpiTd}>Overdue &gt; 7 operational days</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Rating Bar */}
          <div style={styles.ratingPanel}>
            <div style={styles.ratingLeft}>
              <div style={styles.ratingLabel}>Weighted Performance Score</div>
              <div style={{ ...styles.ratingVal, color: ratingColor }}>{metrics.performanceScore}%</div>
            </div>
            <div style={styles.ratingRight}>
              <div style={styles.ratingClassLabel}>Performance Classification:</div>
              <div style={{ ...styles.ratingClassVal, color: ratingColor }}>{ratingLevel}</div>
              <div style={styles.ratingDisclaimer}>
                Score calculated dynamically based on workload volume (40%), resolution rate (30%), and speed/SLA compliance (30%).
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Tickets Registry Table */}
        <div style={styles.section} className="page-break">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ ...styles.sectionHeader, margin: 0 }}>3. Ticket Registry Checklist & Actions</h2>

            {/* Interactive Status Filter Tabs (Hidden on Print) */}
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }} className="no-print">
              {[
                { key: "ALL", label: "All", count: tickets.length },
                { key: "ASSIGNED", label: "Assigned", count: tickets.filter((t: any) => t.status === "ASSIGNED").length },
                { key: "INITIAL_VISIT_COMPLETED", label: "Visited", count: tickets.filter((t: any) => t.status === "INITIAL_VISIT_COMPLETED").length },
                { key: "MATERIAL_REQUESTED", label: "Material Req", count: tickets.filter((t: any) => t.status === "MATERIAL_REQUESTED").length },
                { key: "INSURANCE_SUBMITTED", label: "Insurance", count: tickets.filter((t: any) => t.status === "INSURANCE_SUBMITTED").length },
                { key: "RESOLVED", label: "Resolved", count: tickets.filter((t: any) => t.status === "RESOLVED").length },
                { key: "MANUAL_ASSIGNMENT_REQUIRED", label: "Manual Assign", count: tickets.filter((t: any) => t.status === "MANUAL_ASSIGNMENT_REQUIRED").length }
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setSelectedStatusTab(st.key)}
                  style={{
                    padding: "0.25rem 0.55rem",
                    fontSize: "0.72rem",
                    fontWeight: "700",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: selectedStatusTab === st.key ? "var(--primary)" : "#cbd5e1",
                    backgroundColor: selectedStatusTab === st.key ? "var(--primary)" : "#ffffff",
                    color: selectedStatusTab === st.key ? "#ffffff" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  {st.label} ({st.count})
                </button>
              ))}
            </div>
          </div>

          <table style={styles.ticketTable}>
            <thead>
              <tr>
                <th style={styles.ticketTh}>Ticket ID</th>
                <th style={styles.ticketTh}>Application ID</th>
                <th style={styles.ticketTh}>Ticket Type</th>
                <th style={styles.ticketTh}>Priority</th>
                <th style={styles.ticketTh}>Current Stage</th>
                <th style={styles.ticketTh}>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {tickets
                .filter((t: any) => selectedStatusTab === "ALL" || t.status === selectedStatusTab)
                .map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ ...styles.ticketTd, fontWeight: "600" }}>{t.ticketNumber}</td>
                    <td style={{ ...styles.ticketTd, fontFamily: "monospace" }}>{t.complaint?.applicationId}</td>
                    <td style={styles.ticketTd}>{t.complaint?.complaintType}</td>
                    <td style={{ 
                      ...styles.ticketTd, 
                      fontWeight: "600", 
                      color: t.priority === "CRITICAL" ? "var(--color-manual)" : t.priority === "URGENT" ? "var(--color-material)" : "inherit"
                    }}>
                      {t.priority}
                    </td>
                    <td style={styles.ticketTd}>{t.status.replace(/_/g, " ")}</td>
                    <td style={styles.ticketTd}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              {tickets.filter((t: any) => selectedStatusTab === "ALL" || t.status === selectedStatusTab).length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No tickets found for status "{selectedStatusTab.replace(/_/g, " ")}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Report Footer signatures */}
        <div style={styles.footerSignatures}>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigTitle}>Operations Manager Signature</div>
            <div style={styles.sigSub}>Claro O&M Platform V2</div>
          </div>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigTitle}>Field Engineer Acknowledgement</div>
            <div style={styles.sigSub}>Name: {engineer.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    backgroundColor: "#f4f6f8",
    color: "#1e293b",
    padding: "2rem 1.5rem"
  },
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "80vh",
    fontFamily: "var(--font-title)",
    fontSize: "1rem",
    color: "var(--text-muted)"
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "80vh",
    fontFamily: "var(--font-title)"
  },
  controlsBar: {
    width: "100%",
    maxWidth: "800px",
    margin: "0 auto 1.5rem auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  controlBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem"
  },
  sheet: {
    width: "100%",
    maxWidth: "800px",
    margin: "0 auto",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "3.5rem 3rem",
    boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #e2e8f0",
    paddingBottom: "1.5rem",
    marginBottom: "2rem"
  },
  headerLeft: {
    flex: 1
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem"
  },
  logoText: {
    fontFamily: "var(--font-title)",
    fontSize: "1.1rem",
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: "0.05em"
  },
  reportTitle: {
    fontFamily: "var(--font-title)",
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: "1.2"
  },
  reportSubtitle: {
    fontSize: "0.8rem",
    color: "#64748b",
    marginTop: "0.25rem"
  },
  headerRight: {
    textAlign: "right" as const,
    minWidth: "180px"
  },
  metaRow: {
    marginBottom: "0.4rem"
  },
  metaLabel: {
    fontSize: "0.75rem",
    color: "#64748b",
    marginRight: "0.4rem"
  },
  metaVal: {
    fontSize: "0.8rem",
    fontWeight: "600",
    color: "#0f172a"
  },
  section: {
    marginBottom: "2.25rem"
  },
  sectionHeader: {
    fontFamily: "var(--font-title)",
    fontSize: "1.05rem",
    fontWeight: "700",
    color: "#0f172a",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "0.5rem",
    marginBottom: "1rem"
  },
  bioGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem"
  },
  bioCell: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem"
  },
  bioLabel: {
    fontSize: "0.75rem",
    color: "#64748b"
  },
  bioVal: {
    fontSize: "0.88rem",
    fontWeight: "500",
    color: "#0f172a"
  },
  kpiTableWrapper: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "1.5rem"
  },
  kpiTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    textAlign: "left" as const,
    fontSize: "0.85rem"
  },
  kpiTh: {
    backgroundColor: "#f8fafc",
    padding: "0.75rem 1rem",
    fontWeight: "600",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0"
  },
  kpiTd: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #e2e8f0",
    color: "#1e293b"
  },
  ratingPanel: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    display: "flex",
    padding: "1.25rem",
    gap: "1.5rem"
  },
  ratingLeft: {
    borderRight: "1px solid #e2e8f0",
    paddingRight: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    minWidth: "120px"
  },
  ratingLabel: {
    fontSize: "0.68rem",
    color: "#64748b",
    textTransform: "uppercase" as const,
    fontWeight: "600",
    textAlign: "center" as const
  },
  ratingVal: {
    fontSize: "2.25rem",
    fontWeight: "800",
    marginTop: "0.25rem"
  },
  ratingRight: {
    flex: 1
  },
  ratingClassLabel: {
    fontSize: "0.75rem",
    color: "#64748b"
  },
  ratingClassVal: {
    fontSize: "1.1rem",
    fontWeight: "700",
    marginTop: "0.15rem"
  },
  ratingDisclaimer: {
    fontSize: "0.72rem",
    color: "#64748b",
    marginTop: "0.5rem",
    lineHeight: "1.3"
  },
  ticketTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    textAlign: "left" as const,
    fontSize: "0.8rem",
    marginTop: "0.75rem"
  },
  ticketTh: {
    backgroundColor: "#f8fafc",
    padding: "0.65rem 0.85rem",
    fontWeight: "600",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0"
  },
  ticketTd: {
    padding: "0.65rem 0.85rem",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155"
  },
  footerSignatures: {
    marginTop: "4rem",
    display: "flex",
    justifyContent: "space-between",
    gap: "3rem"
  },
  sigBox: {
    flex: 1
  },
  sigLine: {
    borderTop: "1px solid #94a3b8",
    marginBottom: "0.5rem"
  },
  sigTitle: {
    fontSize: "0.8rem",
    fontWeight: "600",
    color: "#0f172a"
  },
  sigSub: {
    fontSize: "0.75rem",
    color: "#64748b",
    marginTop: "0.15rem"
  }
};
