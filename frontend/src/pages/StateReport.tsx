import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { 
  ArrowLeft, 
  Printer, 
  Compass, 
  MapPin, 
  FileSpreadsheet, 
  AlertCircle
} from "lucide-react";

export function StateReport() {
  const { stateName } = useParams<{ stateName: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data from API
  const [tickets, setTickets] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);

  useEffect(() => {
    async function loadAllData() {
      try {
        setLoading(true);
        // Load up to 1000 tickets to compute full state metrics
        const ticketsData = await api.getTickets("ALL", undefined, undefined, 1000, 0);
        setTickets(ticketsData.tickets || []);

        const engineersData = await api.getEngineers();
        setEngineers(engineersData || []);
      } catch (err: any) {
        setError(err.message || "Failed to load O&M state report metrics.");
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  // Auto trigger browser print once loaded
  useEffect(() => {
    if (tickets.length > 0 && !loading && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tickets, loading, error]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <FileSpreadsheet className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ marginTop: "1rem" }}>Compiling State Operations Audit Report...</p>
      </div>
    );
  }

  if (error || !stateName) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={40} color="var(--color-manual)" />
        <h2>Audit Generation Failed</h2>
        <p style={{ color: "var(--text-muted)", margin: "0.5rem 0 1.5rem 0" }}>{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ==========================================
  // METRICS AGGREGATIONS FOR FILTERED STATE
  // ==========================================
  const stateTickets = tickets.filter(
    t => t.complaint?.masterInstallation?.state?.name?.toUpperCase() === stateName.toUpperCase()
  );

  const totalTickets = stateTickets.length;
  const resolvedTickets = stateTickets.filter(t => t.status === "RESOLVED");
  const totalResolved = resolvedTickets.length;
  const activeTickets = totalTickets - totalResolved;
  
  const resolutionRate = totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 100) : 0;

  // Calculate Average TAT inside the state
  let tatSum = 0;
  resolvedTickets.forEach(t => {
    const created = new Date(t.createdAt).getTime();
    const updated = new Date(t.updatedAt).getTime();
    const diffDays = (updated - created) / (1000 * 60 * 60 * 24);
    tatSum += diffDays > 0 ? diffDays : 1.5;
  });
  const avgTat = totalResolved > 0 ? parseFloat((tatSum / totalResolved).toFixed(1)) : 0;

  // Status distributions inside state
  const statusCounts = {
    RECEIVED: stateTickets.filter(t => t.status === "RECEIVED").length,
    ASSIGNED: stateTickets.filter(t => t.status === "ASSIGNED").length,
    INITIAL_VISIT_COMPLETED: stateTickets.filter(t => t.status === "INITIAL_VISIT_COMPLETED").length,
    MATERIAL_REQUESTED: stateTickets.filter(t => t.status === "MATERIAL_REQUESTED").length,
    INSURANCE_SUBMITTED: stateTickets.filter(t => t.status === "INSURANCE_SUBMITTED").length,
    RESOLVED: totalResolved
  };

  // SLA Warnings inside state (created > 7 days ago and not resolved)
  const now = new Date();
  const slaBreachedCount = stateTickets.filter(t => {
    if (t.status === "RESOLVED") return false;
    const diffDays = Math.abs(now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }).length;

  // Engineers operating in this state (has profile state matching, or has assignments in this state)
  const stateEngineersList = engineers.map(eng => {
    const engTickets = stateTickets.filter(t => t.assignments?.[0]?.engineer?.id === eng.id);
    const totalAssignedInState = engTickets.length;
    const resolvedInState = engTickets.filter(t => t.status === "RESOLVED").length;
    const activeInState = totalAssignedInState - resolvedInState;
    
    const engResRate = totalAssignedInState > 0 ? (resolvedInState / totalAssignedInState) * 100 : 0;
    const volumeScore = Math.min(100, (totalAssignedInState / 10) * 100);
    const scoreVal = Math.round((volumeScore * 0.4) + (engResRate * 0.3) + (85 * 0.3));
    const finalScore = totalAssignedInState > 0 ? Math.max(65, Math.min(98, scoreVal)) : 0;

    return {
      name: eng.name,
      email: eng.email,
      phone: eng.phone,
      total: totalAssignedInState,
      active: activeInState,
      resolved: resolvedInState,
      score: finalScore
    };
  }).filter(e => e.total > 0).sort((a, b) => b.score - a.score);

  // Group tickets by district inside the state
  const districtMap: Record<string, number> = {};
  stateTickets.forEach(t => {
    const dist = t.complaint?.masterInstallation?.district?.name || "Other";
    districtMap[dist] = (districtMap[dist] || 0) + 1;
  });
  const districtSplit = Object.entries(districtMap).sort((a, b) => b[1] - a[1]);

  return (
    <div style={styles.wrapper}>
      {/* Print Overlay Controls */}
      <div className="no-print" style={styles.controlsBar}>
        <button onClick={() => navigate("/")} className="btn-secondary" style={styles.controlBtn}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <button onClick={() => window.print()} className="btn-primary" style={styles.controlBtn}>
          <Printer size={16} /> Trigger Print Dialog
        </button>
      </div>

      {/* Audit Report Sheet */}
      <div style={styles.sheet} className="print-sheet">
        {/* Header Block */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoContainer}>
              <Compass size={24} color="var(--primary)" />
              <span style={styles.logoText}>CLARO O&M SYSTEM</span>
            </div>
            <h1 style={styles.reportTitle}>State Operations & O&M Audit Report</h1>
            <p style={styles.reportSubtitle}>Geographic analytics, pipeline status, and engineer matrix scorecard</p>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Audited State:</span>
              <span style={{ ...styles.metaVal, color: "var(--primary)" }}>{stateName.toUpperCase()}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Generated:</span>
              <span style={styles.metaVal}>{new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* State Metrics KPI Panel */}
        <div style={styles.section}>
          <h2 style={styles.sectionHeader}>1. State Operational Key Performance Indicators</h2>
          <div style={styles.kpiTableWrapper}>
            <table style={styles.kpiTable}>
              <thead>
                <tr>
                  <th style={styles.kpiTh}>Operational Metric</th>
                  <th style={styles.kpiTh}>Target SLA</th>
                  <th style={styles.kpiTh}>Current Value</th>
                  <th style={styles.kpiTh}>Evaluation Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.kpiTd}>Total Registered Tickets</td>
                  <td style={styles.kpiTd}>--</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600" }}>{totalTickets}</td>
                  <td style={styles.kpiTd}>Total caseload inside {stateName}</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Resolved & Closed Cases</td>
                  <td style={styles.kpiTd}>Maximize</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-resolved)" }}>{totalResolved}</td>
                  <td style={styles.kpiTd}>Marked fully closed</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Active Backlog Queue</td>
                  <td style={styles.kpiTd}>Minimize</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-material)" }}>{activeTickets}</td>
                  <td style={styles.kpiTd}>Currently pending resolution</td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Resolution Rate (%)</td>
                  <td style={styles.kpiTd}>&gt; 80%</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--primary)" }}>{resolutionRate}%</td>
                  <td style={{ 
                    ...styles.kpiTd, 
                    fontWeight: "600", 
                    color: resolutionRate >= 80 ? "var(--color-resolved)" : "var(--color-manual)" 
                  }}>
                    {resolutionRate >= 80 ? "SLA Target Met" : "Requires Attention"}
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Average Turn-Around-Time (TAT)</td>
                  <td style={styles.kpiTd}>&lt; 4.0 Days</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600" }}>{avgTat} Days</td>
                  <td style={{ 
                    ...styles.kpiTd, 
                    fontWeight: "600", 
                    color: avgTat <= 4 ? "var(--color-resolved)" : "var(--color-manual)" 
                  }}>
                    {avgTat <= 4 ? "SLA Target Met" : "Requires Attention"}
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>SLA Overdue Cases</td>
                  <td style={styles.kpiTd}>0 Cases</td>
                  <td style={{ ...styles.kpiTd, fontWeight: "600", color: "var(--color-manual)" }}>{slaBreachedCount}</td>
                  <td style={styles.kpiTd}>Open &gt; 7 operational days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* State Pipeline Breakdown */}
        <div style={styles.section}>
          <h2 style={styles.sectionHeader}>2. O&M Case Pipeline Stage Breakdown</h2>
          <div style={styles.grid2Col}>
            <div style={styles.pipelineColumn}>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Received / Registered:</div>
                <div style={styles.pipelineVal}>{statusCounts.RECEIVED} cases</div>
              </div>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Assigned to Field:</div>
                <div style={styles.pipelineVal}>{statusCounts.ASSIGNED} cases</div>
              </div>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Diagnostic Visit Done:</div>
                <div style={styles.pipelineVal}>{statusCounts.INITIAL_VISIT_COMPLETED} cases</div>
              </div>
            </div>
            <div style={styles.pipelineColumn}>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Material Card Requested:</div>
                <div style={styles.pipelineVal}>{statusCounts.MATERIAL_REQUESTED} cases</div>
              </div>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Insurance Claim Submitted:</div>
                <div style={styles.pipelineVal}>{statusCounts.INSURANCE_SUBMITTED} cases</div>
              </div>
              <div style={styles.pipelineItem}>
                <div style={styles.pipelineLabel}>Fully Resolved & Closed:</div>
                <div style={{ ...styles.pipelineVal, color: "var(--color-resolved)", fontWeight: "700" }}>{statusCounts.RESOLVED} cases</div>
              </div>
            </div>
          </div>
        </div>

        {/* Local Engineer Performance Matrix */}
        <div style={styles.section} className="page-break">
          <h2 style={styles.sectionHeader}>3. Local Field Engineer Scorecard Matrix</h2>
          <table style={styles.ticketTable}>
            <thead>
              <tr>
                <th style={styles.ticketTh}>Engineer Name</th>
                <th style={styles.ticketTh}>Email Contact</th>
                <th style={{ ...styles.ticketTh, textAlign: "center" }}>Assigned</th>
                <th style={{ ...styles.ticketTh, textAlign: "center" }}>Resolved</th>
                <th style={{ ...styles.ticketTh, textAlign: "center" }}>Pending</th>
                <th style={{ ...styles.ticketTh, textAlign: "right" }}>Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {stateEngineersList.map(eng => (
                <tr key={eng.email}>
                  <td style={{ ...styles.ticketTd, fontWeight: "600" }}>{eng.name}</td>
                  <td style={styles.ticketTd}>{eng.email}</td>
                  <td style={{ ...styles.ticketTd, textAlign: "center" }}>{eng.total}</td>
                  <td style={{ ...styles.ticketTd, textAlign: "center", color: "var(--color-resolved)", fontWeight: "600" }}>{eng.resolved}</td>
                  <td style={{ ...styles.ticketTd, textAlign: "center", color: "var(--color-material)", fontWeight: "600" }}>{eng.active}</td>
                  <td style={{ 
                    ...styles.ticketTd, 
                    textAlign: "right", 
                    fontWeight: "700", 
                    color: eng.score >= 90 ? "var(--color-resolved)" : eng.score >= 80 ? "var(--primary)" : "var(--color-manual)"
                  }}>
                    {eng.score}%
                  </td>
                </tr>
              ))}
              {stateEngineersList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No field engineers currently deployed in this state.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* District Breakdown Split */}
        <div style={styles.section}>
          <h2 style={styles.sectionHeader}>4. State District Caseload Distribution</h2>
          <div style={styles.districtGrid}>
            {districtSplit.map(([dist, count]) => (
              <div key={dist} style={styles.districtCard}>
                <div style={styles.distName}>
                  <MapPin size={12} color="var(--text-muted)" /> {dist}
                </div>
                <div style={styles.distCount}>{count} Complaints</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Audit signatures */}
        <div style={styles.footerSignatures}>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigTitle}>Auditing Officer Signature</div>
            <div style={styles.sigSub}>O&M Operations Administrator</div>
          </div>
          <div style={styles.sigBox}>
            <div style={styles.sigLine} />
            <div style={styles.sigTitle}>State Operations Lead Acknowledgement</div>
            <div style={styles.sigSub}>Region: {stateName.toUpperCase()}</div>
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
  kpiTableWrapper: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    overflow: "hidden"
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
  grid2Col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.5rem"
  },
  pipelineColumn: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem"
  },
  pipelineItem: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px dashed #e2e8f0",
    paddingBottom: "0.4rem"
  },
  pipelineLabel: {
    fontSize: "0.82rem",
    color: "#64748b"
  },
  pipelineVal: {
    fontSize: "0.82rem",
    fontWeight: "600",
    color: "#0f172a"
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
  districtGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "0.75rem"
  },
  districtCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "0.65rem 0.85rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  distName: {
    fontSize: "0.78rem",
    fontWeight: "600",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "0.25rem"
  },
  distCount: {
    fontSize: "0.75rem",
    color: "#64748b"
  },
  footerSignatures: {
    marginTop: "4.5rem",
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
