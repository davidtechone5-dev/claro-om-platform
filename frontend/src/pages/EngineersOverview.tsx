import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  FileText,
  AlertCircle
} from "lucide-react";

export function EngineersOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [startDate, setStartDate] = useState<string>("2026-07-01");
  const [endDate, setEndDate] = useState<string>("2026-07-15");

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAllEngineersPerformance(startDate || undefined, endDate || undefined);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load O&M Engineer Performance report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const exportCSV = () => {
    if (!data || !data.engineers) return;

    const headers = [
      "Engineer Name",
      "State",
      "Total Assigned (Till Now)",
      "Total Resolved (Till Now)",
      `Assigned in (${data.windowDaysLabel || "Selected Window"})`,
      `Resolved in (${data.windowDaysLabel || "Selected Window"})`
    ];

    const lines: string[] = [
      `"${data.reportTitle || "CLARO ENERGY"} - ${data.subTitle || "O&M Dashboard · Engineer Performance"}"`,
      `"Reporting Window: ${data.reportingWindowLabel || ""}"`,
      `"${data.sourceText || ""}"`,
      "",
      headers.join(",")
    ];

    data.engineers.forEach((eng: any) => {
      lines.push([
        `"${eng.name}"`,
        `"${eng.stateCode}"`,
        eng.totalAssigned,
        eng.totalResolved,
        eng.assignedInWindow,
        eng.resolvedInWindow
      ].join(","));
    });

    if (data.totals) {
      lines.push("");
      lines.push([
        `"Total"`,
        `""`,
        data.totals.totalAssigned,
        data.totals.totalResolved,
        data.totals.assignedInWindow,
        data.totals.resolvedInWindow
      ].join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Claro_Engineer_Performance_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEngineers = data?.engineers ? data.engineers.filter((eng: any) => 
    !searchQuery.trim() || eng.name.toLowerCase().includes(searchQuery.toLowerCase()) || eng.stateCode.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const maxAssigned = data?.engineers ? Math.max(...data.engineers.map((e: any) => e.totalAssigned), 1) : 100;
  const maxResolved = data?.engineers ? Math.max(...data.engineers.map((e: any) => e.totalResolved), 1) : 100;

  return (
    <div style={styles.pageContainer} className="animate-fade-in print-sheet">
      {/* Date Filter & Export Control Bar (Hidden on Print) */}
      <div style={styles.controlBar} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Calendar size={16} color="var(--primary)" />
          <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#334155" }}>Select Date Range:</span>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
              style={styles.dateInput}
            />
            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#64748b" }}>to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              style={styles.dateInput}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={exportCSV} className="btn-secondary" style={styles.actionBtn}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary" style={styles.actionBtn}>
            <Printer size={15} /> Trigger Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Report Header matching Sample PDF */}
      <div style={styles.headerBlock}>
        <div>
          <h1 style={styles.companyTitle}>CLARO ENERGY</h1>
          <p style={styles.subTitle}>O&M Dashboard · Engineer Performance</p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={styles.redWindowBadge}>
            Reporting Window: {data?.reportingWindowLabel || "Jul 1 – Jul 15, 2026"}
          </div>
          <p style={styles.sourceText}>
            {data?.sourceText || "Source: Tickets Generation sheet (live export)"}
          </p>
        </div>
      </div>

      {/* Top Summary KPI Cards Bar */}
      {data?.summaryCards && (
        <div style={{ ...styles.kpiContainer, gridTemplateColumns: "repeat(5, 1fr)" }}>
          <div style={styles.kpiBox}>
            <span style={styles.kpiLabel}>ACTIVE ENGINEERS</span>
            <span style={{ ...styles.kpiVal, color: "#0f172a" }}>{data.summaryCards.activeEngineers}</span>
          </div>
          <div style={styles.kpiBox}>
            <span style={styles.kpiLabel}>TOTAL ASSIGNED (Till Now)</span>
            <span style={{ ...styles.kpiVal, color: "#0f172a" }}>{data.summaryCards.totalAssigned}</span>
          </div>
          <div style={styles.kpiBox}>
            <span style={styles.kpiLabel}>TOTAL RESOLVED (Till Now)</span>
            <span style={{ ...styles.kpiVal, color: "#2e7d32" }}>{data.summaryCards.totalResolved}</span>
          </div>
          <div style={styles.kpiBox}>
            <span style={styles.kpiLabel}>ASSIGNED ({data?.windowDaysLabel || "WINDOW"})</span>
            <span style={{ ...styles.kpiVal, color: "#b91c1c" }}>{data.summaryCards.assignedWindow}</span>
          </div>
          <div style={styles.kpiBox}>
            <span style={styles.kpiLabel}>RESOLVED ({data?.windowDaysLabel || "WINDOW"})</span>
            <span style={{ ...styles.kpiVal, color: "#d97706" }}>{data.summaryCards.resolvedWindow}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <FileText className="animate-spin" size={32} color="#b91c1c" />
          <p style={{ marginTop: "1rem", fontWeight: "600", color: "#64748b" }}>
            Compiling CLARO ENERGY Engineer Performance Report...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.errorCard}>
          <AlertCircle size={28} color="#b91c1c" />
          <div style={{ marginLeft: "0.75rem" }}>
            <h3 style={{ margin: 0, color: "#b91c1c", fontSize: "1rem" }}>Report Generation Failed</h3>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Main Table View */}
      {!loading && !error && data && data.engineers && (
        <>
          {/* Search Input Bar (Hidden on Print) */}
          <div style={styles.searchRow} className="no-print">
            <div style={styles.searchWrapper}>
              <Search size={15} color="#64748b" style={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Filter by engineer name or state code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={styles.searchInput}
              />
            </div>
          </div>

          {/* Table Container */}
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.darkRedHeaderTr}>
                  <th style={{ ...styles.th, textAlign: "left", width: "240px" }}>Engineer Name</th>
                  <th style={{ ...styles.th, textAlign: "center", width: "80px" }}>State</th>
                  <th style={{ ...styles.th, textAlign: "center", width: "160px" }}>Total Assigned<br/><span style={{ fontSize: "0.65rem", fontWeight: "400" }}>(Till Now)</span></th>
                  <th style={{ ...styles.th, textAlign: "center", width: "160px" }}>Total Resolved<br/><span style={{ fontSize: "0.65rem", fontWeight: "400" }}>(Till Now)</span></th>
                  <th style={{ ...styles.th, textAlign: "center", width: "180px" }}>Assigned in<br/><span style={{ fontSize: "0.65rem", fontWeight: "400" }}>({data.windowDaysLabel || "Selected Window"})</span></th>
                  <th style={{ ...styles.th, textAlign: "center", width: "180px" }}>Resolved in<br/><span style={{ fontSize: "0.65rem", fontWeight: "400" }}>({data.windowDaysLabel || "Selected Window"})</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredEngineers.map((eng: any, idx: number) => {
                  const assignedPct = Math.round((eng.totalAssigned / maxAssigned) * 100);
                  const resolvedPct = Math.round((eng.totalResolved / maxResolved) * 100);

                  const assignedBg = `linear-gradient(90deg, #fecaca 0%, #fecaca ${assignedPct}%, transparent ${assignedPct}%)`;
                  const resolvedBg = `linear-gradient(90deg, #bbf7d0 0%, #bbf7d0 ${resolvedPct}%, transparent ${resolvedPct}%)`;

                  return (
                    <tr 
                      key={eng.id} 
                      style={{
                        ...styles.tr,
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: "700", color: "#0f172a" }}>
                        <span 
                          onClick={() => navigate(`/engineers/${eng.id}/report`)}
                          style={{ cursor: "pointer", textDecoration: "none" }}
                          title="View Individual Audit Sheet"
                        >
                          {eng.name}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600" }}>{eng.stateCode}</td>
                      
                      {/* Total Assigned with Inline Red Progress Bar Fill */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "700", background: assignedBg }}>
                        {eng.totalAssigned}
                      </td>

                      {/* Total Resolved with Inline Green Progress Bar Fill */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "700", background: resolvedBg }}>
                        {eng.totalResolved}
                      </td>

                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#b91c1c" }}>{eng.assignedInWindow}</td>
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#d97706" }}>{eng.resolvedInWindow}</td>
                    </tr>
                  );
                })}

                {/* Dark Red Summary Row */}
                {data.totals && (
                  <tr style={styles.darkRedTotalTr}>
                    <td style={{ ...styles.totalTd, textAlign: "left" }}>Total</td>
                    <td style={{ ...styles.totalTd, textAlign: "center" }}></td>
                    <td style={{ ...styles.totalTd, textAlign: "center" }}>{data.totals.totalAssigned}</td>
                    <td style={{ ...styles.totalTd, textAlign: "center" }}>{data.totals.totalResolved}</td>
                    <td style={{ ...styles.totalTd, textAlign: "center" }}>{data.totals.assignedInWindow}</td>
                    <td style={{ ...styles.totalTd, textAlign: "center" }}>{data.totals.resolvedInWindow}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div style={styles.footerNote}>
            Total Assigned / Total Resolved reflect all-time activity in the Tickets Registry. Date range metrics reflect tickets assigned (`assignedAt`) or resolved (`serviceReportDate`) strictly within {data.reportingWindowLabel || "the selected window"}.
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "1.5rem 2rem",
    fontFamily: "var(--font-title, sans-serif)",
    color: "#1e293b"
  },
  controlBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "0.6rem 1rem",
    marginBottom: "1.25rem"
  },
  presetGroup: {
    display: "flex",
    backgroundColor: "#f1f5f9",
    padding: "2px",
    borderRadius: "6px",
    gap: "2px"
  },
  presetBtn: {
    border: "none",
    backgroundColor: "transparent",
    padding: "0.3rem 0.65rem",
    borderRadius: "4px",
    fontSize: "0.78rem",
    fontWeight: "600",
    color: "#64748b",
    cursor: "pointer"
  },
  presetBtnActive: {
    backgroundColor: "#ffffff",
    color: "#b91c1c",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    fontWeight: "700"
  },
  dateInput: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.78rem",
    width: "auto"
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.82rem",
    padding: "0.45rem 0.85rem"
  },
  headerBlock: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1rem"
  },
  companyTitle: {
    fontSize: "1.5rem",
    fontWeight: "900",
    color: "#b91c1c",
    margin: 0,
    letterSpacing: "-0.02em"
  },
  subTitle: {
    fontSize: "0.88rem",
    fontWeight: "600",
    color: "#64748b",
    margin: "0.15rem 0 0 0"
  },
  redWindowBadge: {
    backgroundColor: "#b91c1c",
    color: "#ffffff",
    padding: "0.45rem 1rem",
    borderRadius: "4px",
    fontSize: "0.85rem",
    fontWeight: "700",
    letterSpacing: "0.02em",
    display: "inline-block"
  },
  sourceText: {
    fontSize: "0.72rem",
    fontStyle: "italic" as const,
    color: "#64748b",
    margin: "0.25rem 0 0 0"
  },
  kpiContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "0.5rem",
    marginBottom: "1.25rem"
  },
  kpiBox: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "4px",
    padding: "0.6rem 0.5rem",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start"
  },
  kpiLabel: {
    fontSize: "0.62rem",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.02em",
    lineHeight: "1.1",
    marginBottom: "0.25rem"
  },
  kpiVal: {
    fontSize: "1.4rem",
    fontWeight: "800",
    lineHeight: "1.1"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem"
  },
  errorCard: {
    display: "flex",
    alignItems: "center",
    padding: "1rem",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px"
  },
  searchRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: "0.75rem"
  },
  searchWrapper: {
    position: "relative" as const,
    width: "320px"
  },
  searchIcon: {
    position: "absolute" as const,
    left: "10px",
    top: "50%",
    transform: "translateY(-50%)"
  },
  searchInput: {
    paddingLeft: "2.2rem",
    fontSize: "0.82rem"
  },
  tableCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.8rem"
  },
  darkRedHeaderTr: {
    backgroundColor: "#8b0000"
  },
  th: {
    color: "#ffffff",
    padding: "0.6rem 0.55rem",
    fontSize: "0.72rem",
    fontWeight: "700",
    borderRight: "1px solid rgba(255,255,255,0.15)",
    lineHeight: "1.2"
  },
  tr: {
    borderBottom: "1px solid #e2e8f0"
  },
  td: {
    padding: "0.45rem 0.55rem",
    borderRight: "1px solid #f1f5f9",
    color: "#1e293b",
    fontSize: "0.78rem"
  },
  darkRedTotalTr: {
    backgroundColor: "#8b0000"
  },
  totalTd: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "0.82rem",
    padding: "0.6rem 0.55rem"
  },
  footerNote: {
    fontSize: "0.72rem",
    fontStyle: "italic" as const,
    color: "#64748b",
    marginTop: "0.75rem",
    lineHeight: "1.4"
  }
};
