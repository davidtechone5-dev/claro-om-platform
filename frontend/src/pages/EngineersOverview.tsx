import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  FileText,
  AlertCircle,
  MapPin
} from "lucide-react";

export function EngineersOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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

  const exportCSV = (stateFilterOnly = false) => {
    if (!data || !data.engineers) return;

    let targetEngineers = data.engineers;
    if (stateFilterOnly && selectedState !== "ALL") {
      targetEngineers = targetEngineers.filter((eng: any) => 
        eng.stateCode === selectedState || eng.stateName?.toUpperCase().includes(selectedState.toUpperCase())
      );
    }

    const headers = [
      "Engineer Name",
      "State",
      "All Tickets",
      "Assigned",
      "Visited",
      "Material Req",
      "Insurance",
      "Resolved",
      "Manual Assign"
    ];

    const lines: string[] = [
      `"${data.reportTitle || "CLARO ENERGY"} - ${data.subTitle || "O&M Dashboard · Engineer Performance"}"`,
      `"Reporting Window: ${startDate || "All"} to ${endDate || "All"}"`,
      `"Filter State: ${selectedState}"`,
      "",
      headers.join(",")
    ];

    targetEngineers.forEach((eng: any) => {
      lines.push([
        `"${eng.name}"`,
        `"${eng.stateCode}"`,
        eng.allCount || 0,
        eng.assignedCount || 0,
        eng.visitedCount || 0,
        eng.materialReqCount || 0,
        eng.insuranceCount || 0,
        eng.resolvedCount || 0,
        eng.manualAssignCount || 0
      ].join(","));
    });

    const totalsRow = {
      allCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.allCount || 0), 0),
      assignedCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.assignedCount || 0), 0),
      visitedCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.visitedCount || 0), 0),
      materialReqCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.materialReqCount || 0), 0),
      insuranceCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.insuranceCount || 0), 0),
      resolvedCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.resolvedCount || 0), 0),
      manualAssignCount: targetEngineers.reduce((acc: number, e: any) => acc + (e.manualAssignCount || 0), 0)
    };

    lines.push("");
    lines.push([
      `"Total"`,
      `""`,
      totalsRow.allCount,
      totalsRow.assignedCount,
      totalsRow.visitedCount,
      totalsRow.materialReqCount,
      totalsRow.insuranceCount,
      totalsRow.resolvedCount,
      totalsRow.manualAssignCount
    ].join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const fileNameSuffix = stateFilterOnly && selectedState !== "ALL" ? `_${selectedState}` : "_All";
    link.setAttribute("download", `Claro_Engineer_Report${fileNameSuffix}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statesList = data?.engineers 
    ? Array.from(new Set(data.engineers.map((e: any) => e.stateCode))).filter(Boolean)
    : ["MH", "HR", "MP", "RJ"];

  const filteredEngineers = data?.engineers ? data.engineers.filter((eng: any) => {
    const searchMatch = !searchQuery.trim() || 
      eng.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      eng.stateCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const stateMatch = selectedState === "ALL" || eng.stateCode === selectedState;
    return searchMatch && stateMatch;
  }) : [];

  const totalsFiltered = {
    allCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.allCount || 0), 0),
    assignedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.assignedCount || 0), 0),
    visitedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.visitedCount || 0), 0),
    materialReqCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.materialReqCount || 0), 0),
    insuranceCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.insuranceCount || 0), 0),
    resolvedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.resolvedCount || 0), 0),
    manualAssignCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.manualAssignCount || 0), 0)
  };

  return (
    <div style={styles.pageContainer} className="animate-fade-in print-sheet">
      {/* Date & State Filter & Export Control Bar (Hidden on Print) */}
      <div style={styles.controlBar} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Date Range Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Calendar size={16} color="var(--primary)" />
            <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#334155" }}>Date Range:</span>
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

          {/* State Filter Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <MapPin size={16} color="var(--primary)" />
            <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#334155" }}>State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="form-input"
              style={{ padding: "0.3rem 0.6rem", fontSize: "0.82rem", fontWeight: "600" }}
            >
              <option value="ALL">All States ({data?.engineers?.length || 0} Engineers)</option>
              {statesList.map((st: any) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => exportCSV(false)} className="btn-secondary" style={styles.actionBtn}>
            <Download size={15} /> Export All CSV
          </button>
          {selectedState !== "ALL" && (
            <button onClick={() => exportCSV(true)} className="btn-secondary" style={styles.actionBtn}>
              <Download size={15} /> Export {selectedState} CSV
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary" style={styles.actionBtn}>
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Report Header */}
      <div style={styles.headerBlock}>
        <div>
          <h1 style={styles.companyTitle}>CLARO ENERGY</h1>
          <p style={styles.subTitle}>O&M Dashboard · Engineer Performance Reports</p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={styles.redWindowBadge}>
            Reporting Window: {startDate || "All"} – {endDate || "All"}
          </div>
          <p style={styles.sourceText}>
            Source: Tickets Registry live database export
          </p>
        </div>
      </div>

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

      {/* Main 8-Column Table View */}
      {!loading && !error && data && data.engineers && (
        <>
          {/* Search Input Bar (Hidden on Print) */}
          <div style={styles.searchRow} className="no-print">
            <div style={styles.searchWrapper}>
              <Search size={15} color="#64748b" style={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search engineer by name or state..."
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
                  <th style={{ ...styles.th, textAlign: "left" }}>Engineer</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>All Tickets</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Assigned</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Visited</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Material Req</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Insurance</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Resolved</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Manual Assign</th>
                </tr>
              </thead>
              <tbody>
                {filteredEngineers.map((eng: any, idx: number) => {
                  return (
                    <tr 
                      key={eng.id} 
                      style={{
                        ...styles.tr,
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      {/* 1. Engineer Name & State */}
                      <td style={{ ...styles.td, fontWeight: "700", color: "#0f172a" }}>
                        <span 
                          onClick={() => navigate(`/engineers/${eng.id}/report?startDate=${startDate}&endDate=${endDate}`)}
                          style={{ cursor: "pointer", color: "#2563eb", textDecoration: "underline" }}
                          title="Click to view detailed scorecard audit report"
                        >
                          {eng.name}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "0.5rem" }}>
                          ({eng.stateCode})
                        </span>
                      </td>

                      {/* 2. All Tickets */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "800", color: "#0f172a" }}>
                        {eng.allCount || 0}
                      </td>

                      {/* 3. Assigned */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#2563eb" }}>
                        {eng.assignedCount || 0}
                      </td>

                      {/* 4. Visited */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#0891b2" }}>
                        {eng.visitedCount || 0}
                      </td>

                      {/* 5. Material Req */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#d97706" }}>
                        {eng.materialReqCount || 0}
                      </td>

                      {/* 6. Insurance */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#9333ea" }}>
                        {eng.insuranceCount || 0}
                      </td>

                      {/* 7. Resolved */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "700", color: "#16a34a" }}>
                        {eng.resolvedCount || 0}
                      </td>

                      {/* 8. Manual Assign */}
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: "600", color: "#dc2626" }}>
                        {eng.manualAssignCount || 0}
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Totals Row */}
                <tr style={styles.darkRedTotalTr}>
                  <td style={{ ...styles.totalTd, textAlign: "left" }}>Total ({filteredEngineers.length} Engineers)</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.allCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.assignedCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.visitedCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.materialReqCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.insuranceCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.resolvedCount}</td>
                  <td style={{ ...styles.totalTd, textAlign: "center" }}>{totalsFiltered.manualAssignCount}</td>
                </tr>
              </tbody>
            </table>
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
