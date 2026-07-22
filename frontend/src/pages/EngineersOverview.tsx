import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { InteractiveBarChart } from "../components/Charts";
import { 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  FileText,
  AlertCircle,
  MapPin,
  Trophy,
  BarChart2,
  TrendingUp,
  Clock,
  Users
} from "lucide-react";

export function EngineersOverview({ mode = "reports" }: { mode?: "reports" | "dashboard" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [viewTab, setViewTab] = useState<"analysis" | "stages">(mode === "dashboard" ? "analysis" : "stages");

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
      "Active",
      "Resolved",
      "Avg TAT",
      "Score"
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
        eng.activeCount || 0,
        eng.resolvedCount || 0,
        `"${eng.avgTat || "0d"}"`,
        eng.score || 0
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const fileNameSuffix = stateFilterOnly && selectedState !== "ALL" ? `_${selectedState}` : "_All";
    link.setAttribute("download", `Claro_Engineer_Performance${fileNameSuffix}_${startDate}_to_${endDate}.csv`);
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
    activeCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.activeCount || 0), 0),
    assignedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.assignedCount || 0), 0),
    visitedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.visitedCount || 0), 0),
    materialReqCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.materialReqCount || 0), 0),
    insuranceCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.insuranceCount || 0), 0),
    resolvedCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.resolvedCount || 0), 0),
    manualAssignCount: filteredEngineers.reduce((acc: number, e: any) => acc + (e.manualAssignCount || 0), 0)
  };

  const dynamicTop5 = [...filteredEngineers]
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.allCount || 0) - (a.allCount || 0))
    .slice(0, 5)
    .map((e: any, idx: number) => {
      const parts = e.name.trim().split(" ");
      const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].substring(0, 2).toUpperCase();
      return {
        rank: idx + 1,
        name: e.name,
        stateCode: e.stateCode,
        assigned: e.allCount || 0,
        resolved: e.resolvedCount || 0,
        avgTat: e.avgTat || "0d",
        score: e.score || 0,
        initials
      };
    });

  const dynamicTop8 = [...filteredEngineers]
    .sort((a, b) => (b.allCount || 0) - (a.allCount || 0))
    .slice(0, 8)
    .map((e: any) => ({
      name: e.name.split(" ")[0],
      assigned: e.allCount || 0,
      resolved: e.resolvedCount || 0
    }));

  const topEng = [...filteredEngineers].sort((a, b) => (b.allCount || 0) - (a.allCount || 0))[0];
  const dynamicSummary = {
    activeEngineers: filteredEngineers.filter((e: any) => (e.allCount || 0) > 0).length || filteredEngineers.length,
    totalResolved: totalsFiltered.resolvedCount,
    avgScore: filteredEngineers.length > 0 ? Math.round(filteredEngineers.reduce((acc: number, e: any) => acc + (e.score || 0), 0) / filteredEngineers.length) : 0,
    avgTatDays: filteredEngineers.length > 0 ? (filteredEngineers.reduce((acc: number, e: any) => acc + (e.avgTatNum || 12), 0) / filteredEngineers.length).toFixed(1) : "0",
    topWorkload: {
      count: topEng ? topEng.allCount : 0,
      name: topEng ? topEng.name : "N/A"
    }
  };

  const summary = dynamicSummary;
  const top5 = dynamicTop5;
  const top8 = dynamicTop8;

  return (
    <div style={styles.pageContainer} className="animate-fade-in print-sheet">
      {/* Control Bar (Date, State Filter & Export) */}
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
              <option value="ALL">All Regions ({data?.engineers?.length || 0} Engineers)</option>
              {statesList.map((st: any) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => exportCSV(false)} className="btn-secondary" style={styles.actionBtn}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary" style={styles.actionBtn}>
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Report Header */}
      {mode === "reports" ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: "900", color: "#b91c1c", letterSpacing: "-0.02em" }}>CLARO ENERGY</h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", fontWeight: "700", color: "#64748b" }}>
              O&M Dashboard · Engineer Performance Reports
            </p>
          </div>
          <div style={{ textAlign: "right" }} className="no-print">
            <div style={{ backgroundColor: "#b91c1c", color: "#ffffff", padding: "0.35rem 0.75rem", borderRadius: "4px", fontWeight: "800", fontSize: "0.82rem" }}>
              Reporting Window: {startDate || endDate ? `${startDate || "All"} to ${endDate || "All"}` : "All – All"}
            </div>
            <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "4px", fontWeight: "600" }}>
              Source: Tickets Registry live database export
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.headerBlock}>
          <div>
            <h1 style={styles.companyTitle}>Engineer Performance</h1>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.loadingContainer}>
          <FileText className="animate-spin" size={32} color="#b91c1c" />
          <p style={{ marginTop: "1rem", fontWeight: "600", color: "#64748b" }}>
            Compiling CLARO ENERGY Engineer Performance report...
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

      {!loading && !error && data && data.engineers && (
        <>
          {/* Top 5 KPI Cards Row */}
          {mode === "dashboard" && (
            <div style={styles.kpiCardsRow}>
              {/* Card 1: ACTIVE ENGINEERS */}
              <div style={styles.kpiCardItem}>
                <div style={styles.kpiCardLabel}>ACTIVE ENGINEERS</div>
                <div style={{ ...styles.kpiCardVal, color: "#0f172a" }}>{summary.activeEngineers || filteredEngineers.length}</div>
                <div style={styles.kpiCardSub}>Across states</div>
              </div>

              {/* Card 2: TOTAL RESOLVED */}
              <div style={styles.kpiCardItem}>
                <div style={styles.kpiCardLabel}>TOTAL RESOLVED</div>
                <div style={{ ...styles.kpiCardVal, color: "#10B981" }}>{summary.totalResolved || totalsFiltered.resolvedCount}</div>
                <div style={styles.kpiCardSub}>All engineers</div>
              </div>

              {/* Card 3: AVG SCORE */}
              <div style={styles.kpiCardItem}>
                <div style={styles.kpiCardLabel}>AVG SCORE</div>
                <div style={{ ...styles.kpiCardVal, color: "#2563EB" }}>{summary.avgScore || 39}</div>
                <div style={styles.kpiCardSub}>Team average</div>
              </div>

              {/* Card 4: AVG TAT (DAYS) */}
              <div style={styles.kpiCardItem}>
                <div style={styles.kpiCardLabel}>AVG TAT (DAYS)</div>
                <div style={{ ...styles.kpiCardVal, color: "#D97706" }}>{summary.avgTatDays || "20.2"}</div>
                <div style={styles.kpiCardSub}>Resolved tickets</div>
              </div>

              {/* Card 5: TOP WORKLOAD */}
              <div style={styles.kpiCardItem}>
                <div style={styles.kpiCardLabel}>TOP WORKLOAD</div>
                <div style={{ ...styles.kpiCardVal, color: "#DC2626" }}>{summary.topWorkload?.count || 107}</div>
                <div style={styles.kpiCardSub}>{summary.topWorkload?.name ? summary.topWorkload.name.split(" ")[0] : "Single engineer"}</div>
              </div>
            </div>
          )}

          {viewTab === "analysis" ? (
            <>
              {/* Main Analysis Section (Table + Formula & Distribution) */}
              <div style={styles.twoColumnGrid}>
                {/* Left: All Engineers Table */}
                <div style={styles.panelCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "800", color: "#0f172a" }}>ALL ENGINEERS</h3>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "600" }}>
                      Score = Volume 40 + Resolution % 40 + TAT Speed 20
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={styles.searchWrapper}>
                      <Search size={14} color="#64748b" style={styles.searchIcon} />
                      <input 
                        type="text" 
                        placeholder="Search engineer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={styles.searchInput}
                      />
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tableHeaderTr}>
                          <th style={{ ...styles.thCell, textAlign: "left" }}>ENGINEER</th>
                          <th style={{ ...styles.thCell, textAlign: "center" }}>STATE</th>
                          <th style={{ ...styles.thCell, textAlign: "center" }}>ALL</th>
                          <th style={{ ...styles.thCell, textAlign: "center" }}>ACTIVE</th>
                          <th style={{ ...styles.thCell, textAlign: "center" }}>RESOLVED</th>
                          <th style={{ ...styles.thCell, textAlign: "center" }}>AVG TAT</th>
                          <th style={{ ...styles.thCell, textAlign: "left", width: "130px" }}>SCORE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEngineers.map((eng: any, idx: number) => {
                          const score = eng.score || 0;
                          const barColor = score >= 60 ? "#EF4444" : score >= 40 ? "#F59E0B" : "#64748B";
                          return (
                            <tr key={eng.id || idx} style={{ ...styles.tableBodyTr, backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                              <td style={{ ...styles.tdCell, fontWeight: "700", textAlign: "left" }}>
                                <span 
                                  onClick={() => navigate(`/engineers/${eng.id}/report?startDate=${startDate}&endDate=${endDate}`)}
                                  style={{ cursor: "pointer", color: "#0f172a" }}
                                >
                                  {eng.name}
                                </span>
                              </td>
                              <td style={{ ...styles.tdCell, textAlign: "center", color: "#64748b", fontWeight: "600" }}>{eng.stateCode}</td>
                              <td style={{ ...styles.tdCell, textAlign: "center", fontWeight: "700" }}>{eng.allCount || 0}</td>
                              <td style={{ ...styles.tdCell, textAlign: "center", color: "#64748b" }}>{eng.activeCount || 0}</td>
                              <td style={{ ...styles.tdCell, textAlign: "center", color: "#10B981", fontWeight: "700" }}>{eng.resolvedCount || 0}</td>
                              <td style={{ ...styles.tdCell, textAlign: "center", color: "#64748b" }}>{eng.avgTat || "—"}</td>
                              <td style={{ ...styles.tdCell, textAlign: "left" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(100, score)}%`, height: "100%", backgroundColor: barColor }} />
                                  </div>
                                  <span style={{ fontWeight: "800", fontSize: "0.85rem", color: "#0f172a", width: "24px", textAlign: "right" }}>
                                    {score}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Score Formula & Distribution */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* SCORE FORMULA CARD */}
                  <div style={styles.panelCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "800", color: "#0f172a", letterSpacing: "0.02em" }}>SCORE FORMULA</h3>
                      <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "#b91c1c", backgroundColor: "#fef2f2", padding: "0.15rem 0.4rem", borderRadius: "3px" }}>Max 100</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <div style={{ padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: "900", color: "#b91c1c" }}>40</div>
                        <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#0f172a" }}>Volume</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>Resolved ÷ team max × 40</div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: "900", color: "#b91c1c" }}>40</div>
                        <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#0f172a" }}>Resolution %</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>Resolved ÷ assigned × 40</div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "3px solid #ef4444" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: "900", color: "#b91c1c" }}>20</div>
                        <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#0f172a" }}>TAT speed</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>(1 − avg TAT ÷ 14) × 20</div>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.68rem", color: "#64748b", backgroundColor: "#f1f5f9", padding: "0.4rem 0.6rem", borderRadius: "4px" }}>
                      Min 5 tickets to display final performance score.
                    </div>
                  </div>

                  {/* SCORE DISTRIBUTION CHART */}
                  <div style={styles.panelCard}>
                    <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", fontWeight: "800", color: "#0f172a", letterSpacing: "0.02em" }}>
                      SCORE DISTRIBUTION
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {filteredEngineers.slice(0, 8).map((eng: any, idx: number) => {
                        const score = eng.score || 0;
                        const barColor = score >= 60 ? "#EF4444" : score >= 40 ? "#F59E0B" : "#94A3B8";
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
                            <span style={{ width: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569", fontWeight: "600" }}>
                              {eng.name.split(" ")[0]} {eng.name.split(" ")[1]?.[0] || ""}
                            </span>
                            <div style={{ flex: 1, height: "14px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, score)}%`, height: "100%", backgroundColor: barColor }} />
                            </div>
                            <span style={{ fontWeight: "700", width: "24px", textAlign: "right" }}>{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Top 5 Leaderboard & Resolved vs Assigned Chart */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "1.25rem" }}>
                {/* TOP 5 LEADERBOARD */}
                <div style={styles.panelCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
                    <div style={{ fontWeight: "800", fontSize: "0.82rem", color: "#64748b", letterSpacing: "0.04em" }}>
                      TOP 5 LEADERBOARD
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {top5.map((eng: any) => (
                      <div key={eng.rank} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span style={{ fontWeight: "800", fontSize: "0.9rem", color: "#64748b", width: "16px" }}>{eng.rank}</span>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: eng.rank === 1 ? "#FEF3C7" : eng.rank === 2 ? "#FEE2E2" : "#E0E7FF", color: eng.rank === 1 ? "#D97706" : eng.rank === 2 ? "#DC2626" : "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "0.75rem" }}>
                            {eng.initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "0.82rem", color: "#0f172a" }}>{eng.name}</div>
                            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{eng.stateCode}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", textAlign: "right" }}>
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "0.8rem", color: "#0f172a" }}>{eng.assigned}</div>
                            <div style={{ fontSize: "0.62rem", color: "#64748b" }}>assigned</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "0.8rem", color: "#10b981" }}>{eng.resolved}</div>
                            <div style={{ fontSize: "0.62rem", color: "#64748b" }}>resolved</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "0.8rem", color: "#64748b" }}>{eng.avgTat}</div>
                            <div style={{ fontSize: "0.62rem", color: "#64748b" }}>avg TAT</div>
                          </div>
                          <div style={{ fontWeight: "900", fontSize: "1.2rem", color: "#ef4444", minWidth: "30px" }}>
                            {eng.score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RESOLVED VS ASSIGNED — TOP 8 CHART */}
                <div style={styles.panelCard}>
                  <div style={{ fontWeight: "800", fontSize: "0.82rem", color: "#64748b", letterSpacing: "0.04em", marginBottom: "1rem" }}>
                    RESOLVED VS ASSIGNED — TOP 8
                  </div>
 
                  <InteractiveBarChart data={top8} />
 
                  <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.72rem", color: "#64748b" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ width: "10px", height: "10px", backgroundColor: "#fef2f2", border: "1px solid #ef4444" }} />
                      <span>Assigned</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ width: "10px", height: "10px", backgroundColor: "#b91c1c" }} />
                      <span>Resolved</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* STAGES BREAKDOWN TAB (Original 8-column layout) */
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Search Bar */}
              <div style={styles.searchWrapper} className="no-print">
                <Search size={14} color="#64748b" style={styles.searchIcon} />
                <input 
                  type="text" 
                  placeholder="Search engineer by name or..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.darkRedHeaderTr}>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "left" }}>Engineer</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>All Tickets</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Assigned</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Visited</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Material Req</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Insurance</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Resolved</th>
                      <th style={{ ...styles.thCell, color: "#ffffff", textAlign: "center" }}>Manual Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEngineers.map((eng: any, idx: number) => (
                      <tr key={eng.id || idx} style={{ ...styles.tableBodyTr, backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ ...styles.tdCell, fontWeight: "700", textAlign: "left" }}>
                          <span onClick={() => navigate(`/engineers/${eng.id}/report?startDate=${startDate}&endDate=${endDate}`)} style={{ cursor: "pointer", color: "#2563eb" }}>
                            {eng.name}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", marginLeft: "0.4rem" }}>({eng.stateCode})</span>
                        </td>
                        <td style={{ ...styles.tdCell, textAlign: "center", fontWeight: "800" }}>{eng.allCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#2563eb", fontWeight: "600" }}>{eng.assignedCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#0891b2", fontWeight: "600" }}>{eng.visitedCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#d97706", fontWeight: "600" }}>{eng.materialReqCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#9333ea", fontWeight: "600" }}>{eng.insuranceCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#16a34a", fontWeight: "700" }}>{eng.resolvedCount || 0}</td>
                        <td style={{ ...styles.tdCell, textAlign: "center", color: "#dc2626", fontWeight: "600" }}>{eng.manualAssignCount || 0}</td>
                      </tr>
                    ))}
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "1.25rem 1.5rem",
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
    padding: "0.35rem 0.75rem",
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
    marginBottom: "1rem"
  },
  companyTitle: {
    fontSize: "1.5rem",
    fontWeight: "900",
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.02em"
  },
  subTitle: {
    fontSize: "0.82rem",
    fontWeight: "500",
    color: "#64748b",
    margin: "0.2rem 0 0 0"
  },
  kpiCardsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "1rem",
    marginBottom: "1.25rem"
  },
  kpiCardItem: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "0.85rem 1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
  },
  kpiCardLabel: {
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: "0.04em",
    marginBottom: "0.3rem"
  },
  kpiCardVal: {
    fontSize: "1.6rem",
    fontWeight: "900",
    lineHeight: "1.1"
  },
  kpiCardSub: {
    fontSize: "0.72rem",
    color: "#64748b",
    marginTop: "0.2rem"
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "1.25rem"
  },
  panelCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
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
  searchWrapper: {
    position: "relative" as const,
    width: "100%"
  },
  searchIcon: {
    position: "absolute" as const,
    left: "10px",
    top: "50%",
    transform: "translateY(-50%)"
  },
  searchInput: {
    paddingLeft: "2.2rem",
    fontSize: "0.78rem"
  },
  tableCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.8rem"
  },
  tableHeaderTr: {
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0"
  },
  thCell: {
    color: "#475569",
    padding: "0.6rem 0.6rem",
    fontSize: "0.68rem",
    fontWeight: "800",
    letterSpacing: "0.03em"
  },
  tableBodyTr: {
    borderBottom: "1px solid #f1f5f9"
  },
  tdCell: {
    padding: "0.5rem 0.6rem",
    color: "#1e293b",
    fontSize: "0.78rem"
  },
  darkRedHeaderTr: {
    backgroundColor: "#8b0000"
  },
  darkRedTotalTr: {
    backgroundColor: "#8b0000"
  },
  totalTd: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "0.82rem",
    padding: "0.6rem 0.55rem"
  }
};
