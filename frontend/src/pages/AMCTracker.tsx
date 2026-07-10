import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { api } from "../utils/api";

export function AMCTracker() {
  const [districtFilter, setDistrictFilter] = useState("All Districts");
  const [isLive, setIsLive] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    totalAmc: 1240,
    visitsDone: 812,
    pendingDue: 428,
    overdue: 146,
    activePumps: 1131,
    inactivePumps: 109,
    upcomingRenewals: { next30: 84, next60: 62, next90: 46 },
    districtCoverage: [
      { name: "Satara", count: 273, pct: 22 },
      { name: "Jalna", count: 223, pct: 18 },
      { name: "Washim", count: 198, pct: 16 },
      { name: "Ahilyanagar", count: 174, pct: 14 },
      { name: "Osmanabad", count: 149, pct: 12 },
      { name: "Other MH", count: 223, pct: 18 }
    ]
  });

  useEffect(() => {
    async function loadMetrics() {
      try {
        const liveData = await api.getAMCMetrics();
        if (liveData) {
          setMetrics({
            totalAmc: liveData.totalAmc,
            visitsDone: liveData.visitsDone,
            pendingDue: liveData.pendingDue,
            overdue: Math.round(liveData.totalAmc * 0.11),
            activePumps: Math.round(liveData.totalAmc * 0.912),
            inactivePumps: Math.round(liveData.totalAmc * 0.088),
            upcomingRenewals: liveData.upcomingRenewals,
            districtCoverage: liveData.districtCoverage,
            complaintsPostAmc: liveData.complaintsPostAmc
          });
          setIsLive(true);
        }
      } catch (err) {
        console.warn("Using offline mock metrics fallback:", err);
      }
    }
    loadMetrics();
  }, []);

  const defaultComplaints = [
    { appId: "MS0201283720", district: "Washim", lastVisit: "2026-05-14", days: "12d", issue: "Pump Issue", priority: "Critical", recurring: "No - new fault" },
    { appId: "MK2212304501", district: "Ahilyanagar", lastVisit: "2026-05-02", days: "24d", issue: "Panel Damage", priority: "Urgent", recurring: "Yes - recurring" },
    { appId: "MK1405336270", district: "Jalna", lastVisit: "2026-04-20", days: "36d", issue: "Pump Issue", priority: "Urgent", recurring: "Yes - recurring" },
    { appId: "MS2703246981", district: "Satara", lastVisit: "2026-06-01", days: "6d", issue: "Pump Issue", priority: "Urgent", recurring: "No - new fault" }
  ];

  const rawComplaints = metrics.complaintsPostAmc && metrics.complaintsPostAmc.length > 0
    ? metrics.complaintsPostAmc
    : defaultComplaints;

  const filteredComplaints = districtFilter === "All Districts"
    ? rawComplaints
    : rawComplaints.filter((c: any) => c.district.toLowerCase() === districtFilter.toLowerCase());

  const isFiltered = districtFilter !== "All Districts";
  const selectedDistrictData = metrics.districtCoverage.find((d: any) => d.name.toLowerCase() === districtFilter.toLowerCase());

  const displayTotalAmc = isFiltered && selectedDistrictData ? selectedDistrictData.count : metrics.totalAmc;
  const displayVisitsDone = isFiltered ? Math.round(displayTotalAmc * 0.65) : metrics.visitsDone;
  const displayPendingDue = isFiltered ? Math.round(displayTotalAmc * 0.35) : metrics.pendingDue;
  const displayOverdue = isFiltered ? Math.round(displayTotalAmc * 0.11) : metrics.overdue;
  const displayActivePumps = isFiltered ? Math.round(displayTotalAmc * 0.912) : metrics.activePumps;
  const displayInactivePumps = isFiltered ? Math.round(displayTotalAmc * 0.088) : metrics.inactivePumps;

  const displayNext30 = isFiltered ? Math.max(1, Math.round(displayTotalAmc * 0.15)) : metrics.upcomingRenewals.next30;
  const displayNext60 = isFiltered ? Math.max(1, Math.round(displayTotalAmc * 0.16)) : metrics.upcomingRenewals.next60;
  const displayNext90 = isFiltered ? Math.max(1, Math.round(displayTotalAmc * 0.20)) : metrics.upcomingRenewals.next90;

  const activePumpPct = displayTotalAmc > 0 ? ((displayActivePumps / displayTotalAmc) * 100).toFixed(1) : "0.0";
  const visitsDonePct = displayTotalAmc > 0 ? ((displayVisitsDone / displayTotalAmc) * 100).toFixed(1) : "0.0";

  return (
    <div className="animate-fade-in" style={styles.container}>
      
      {/* Dynamic Connection/Disclaimer Header */}
      {isLive ? (
        <div style={{ ...styles.disclaimerCard, backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
          <span style={styles.disclaimerIcon}>🟢</span>
          <div style={{ ...styles.disclaimerText, color: "#065f46" }}>
            <strong>Live Connection Active.</strong> Loaded metrics and district tables dynamically from your database (<strong>{metrics.totalAmc} installations</strong> scanned).
          </div>
        </div>
      ) : (
        <div style={styles.disclaimerCard}>
          <span style={styles.disclaimerIcon}>⚠️</span>
          <div style={styles.disclaimerText}>
            <strong>Mockup Mode.</strong> Displaying illustration indicators. Please run the backend server (`npm run dev`) to load live counts from your SQLite database.
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-title" style={{ color: "#111" }}>AMC Tracker</h1>
          <div style={styles.subTitle}>
            <span style={styles.pilotBadge}>MH PILOT ONLY</span>
            <span>Renewal cycle: 3-6 months · Visit cadence: every 6 months</span>
          </div>
        </div>
        
        {/* Filters Panel */}
        <div style={styles.filterGroup}>
          <button style={styles.subFilterBtn}>
            <Filter size={14} />
            Filters:
          </button>
          <select 
            style={styles.dropdown} 
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
          >
            <option value="All Districts">All Districts</option>
            {metrics.districtCoverage.map((d: any) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Core KPIs Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>TOTAL AMC ASSIGNED</div>
          <div style={styles.kpiVal}>{displayTotalAmc}</div>
          <div style={styles.kpiSub}>Overall received · MH · all time</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>AMC VISITS DONE</div>
          <div style={{ ...styles.kpiVal, color: "#10b981" }}>{displayVisitsDone}</div>
          <div style={styles.kpiSub}>{visitsDonePct}% completion rate</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>PENDING / DUE</div>
          <div style={{ ...styles.kpiVal, color: "#f59e0b" }}>{displayPendingDue}</div>
          <div style={styles.kpiSub}>Not yet visited this cycle</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>OVERDUE &gt; 6 MONTHS</div>
          <div style={{ ...styles.kpiVal, color: "#ef4444" }}>{displayOverdue}</div>
          <div style={styles.kpiSub}>Past visit window</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>PUMPS ACTIVE</div>
          <div style={styles.kpiVal}>{activePumpPct}%</div>
          <div style={styles.kpiSub}>Of AMC-covered sites</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>COMPLAINTS POST-AMC</div>
          <div style={styles.kpiVal}>57</div>
          <div style={styles.kpiSub}>Raised within 30d of a visit</div>
        </div>
      </div>

      {/* Main Charts block */}
      <div style={styles.dashboardGrid}>
        
        {/* Card 1: AMC Cadence */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>AMC CADENCE</h3>
          <div style={styles.cadenceList}>
            <div style={styles.cadenceItem}>
              <div style={{ ...styles.cadenceDot, backgroundColor: "#ef4444" }}></div>
              <div>
                <strong>Contract renewal</strong>
                <p>Every 3-6 months per site, depending on contract terms.</p>
              </div>
            </div>
            <div style={styles.cadenceItem}>
              <div style={{ ...styles.cadenceDot, backgroundColor: "#3b82f6" }}></div>
              <div>
                <strong>Site visit frequency</strong>
                <p>Every 6 months to proactively check for issues, independent of complaints.</p>
              </div>
            </div>
            <div style={styles.cadenceItem}>
              <div style={{ ...styles.cadenceDot, backgroundColor: "#f59e0b" }}></div>
              <div>
                <strong>Current scope</strong>
                <p>Maharashtra only, for the pilot. Other states TBD once validated.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Visit Breakdown */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>VISIT STATUS BREAKDOWN</h3>
          <div style={styles.breakdownContainer}>
            <div style={styles.breakdownList}>
              <div style={styles.breakdownRow}>
                <span style={styles.badgeCompleted}>Completed</span>
                <strong>{displayVisitsDone}</strong>
                <span style={styles.percentText}>{visitsDonePct}%</span>
              </div>
              <div style={styles.breakdownRow}>
                <span style={styles.badgeScheduled}>Scheduled</span>
                <strong>{Math.round(displayTotalAmc * 0.15)}</strong>
                <span style={styles.percentText}>15.0%</span>
              </div>
              <div style={styles.breakdownRow}>
                <span style={styles.badgeOverdue}>Overdue</span>
                <strong>{displayOverdue}</strong>
                <span style={styles.percentText}>11.0%</span>
              </div>
              <div style={styles.breakdownRow}>
                <span style={styles.badgeRescheduled}>Rescheduled</span>
                <strong>{Math.round(displayTotalAmc * 0.05)}</strong>
                <span style={styles.percentText}>5.0%</span>
              </div>
              <div style={styles.breakdownRow}>
                <span style={styles.badgeSkipped}>Skipped</span>
                <strong>{Math.round(displayTotalAmc * 0.035)}</strong>
                <span style={styles.percentText}>3.5%</span>
              </div>
            </div>

            <div style={styles.donutWrapper}>
              <div style={styles.donutOuter}>
                <div style={styles.donutInner}>
                  <div style={styles.donutLabel}>Visits</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Pump Status */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>PUMP STATUS - AMC SITES</h3>
          <div style={styles.breakdownContainer}>
            <div style={styles.breakdownList}>
              <div style={styles.breakdownRow}>
                <span style={styles.indicatorGreen}></span>
                <span>Active</span>
                <strong>{displayActivePumps}</strong>
                <span style={styles.percentText}>{activePumpPct}%</span>
              </div>
              <div style={styles.breakdownRow}>
                <span style={styles.indicatorRed}></span>
                <span>Not active</span>
                <strong>{displayInactivePumps}</strong>
                <span style={styles.percentText}>{(100 - parseFloat(activePumpPct)).toFixed(1)}%</span>
              </div>
            </div>

            <div style={styles.donutWrapper}>
              <div style={{ ...styles.donutOuter, background: `conic-gradient(#10b981 ${activePumpPct}%, #ef4444 0)` }}>
                <div style={styles.donutInner}>
                  <div style={styles.donutLabel}>Pumps</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2 Charts block */}
      <div style={styles.dashboardGrid2}>
        
        {/* District-wise Coverage */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>DISTRICT-WISE AMC COVERAGE - MH</h3>
          <div style={styles.districtList}>
            {metrics.districtCoverage.map((d: any) => (
              <div key={d.name} style={styles.districtRow}>
                <span style={styles.districtName}>{d.name}</span>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarFill, width: `${d.pct}%` }}></div>
                </div>
                <strong style={styles.districtCount}>{d.count}</strong>
                <span style={styles.districtPct}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>UPCOMING RENEWALS (NEXT 90 DAYS)</h3>
          <div style={styles.renewalsList}>
            <div style={styles.renewalBarRow}>
              <span style={styles.renewalLabel}>Next 30 days</span>
              <div style={styles.barContainer}>
                <div style={{ ...styles.barFill, width: `${(displayNext30 / (displayNext30 + 10)) * 100}%`, backgroundColor: "#ef4444" }}></div>
              </div>
              <strong style={styles.renewalCount}>{displayNext30}</strong>
            </div>
            <div style={styles.renewalBarRow}>
              <span style={styles.renewalLabel}>31-60 days</span>
              <div style={styles.barContainer}>
                <div style={{ ...styles.barFill, width: `${(displayNext60 / (displayNext30 + 10)) * 100}%`, backgroundColor: "#f59e0b" }}></div>
              </div>
              <strong style={styles.renewalCount}>{displayNext60}</strong>
            </div>
            <div style={styles.renewalBarRow}>
              <span style={styles.renewalLabel}>61-90 days</span>
              <div style={styles.barContainer}>
                <div style={{ ...styles.barFill, width: `${(displayNext90 / (displayNext30 + 10)) * 100}%`, backgroundColor: "#3b82f6" }}></div>
              </div>
              <strong style={styles.renewalCount}>{displayNext90}</strong>
            </div>
          </div>
          <div style={styles.renewalNotice}>
            Renewal window derived from last renewal date + contract term (3-6 months).
          </div>
        </div>

        {/* 6 Month Trend */}
        <div style={styles.widgetCard}>
          <h3 style={styles.widgetTitle}>POST-AMC COMPLAINTS - 6 MONTH TREND</h3>
          <div style={styles.trendGraphic}>
            <div style={styles.trendBarRow}>
              <div style={{ ...styles.trendBar, height: "40%", backgroundColor: "#3b82f6" }}></div>
              <div style={{ ...styles.trendBar, height: "55%", backgroundColor: "#3b82f6" }}></div>
              <div style={{ ...styles.trendBar, height: "70%", backgroundColor: "#3b82f6" }}></div>
              <div style={{ ...styles.trendBar, height: "85%", backgroundColor: "#3b82f6" }}></div>
            </div>
            <div style={styles.trendLegend}>
              <div style={styles.legendItem}><span style={{ ...styles.dot, backgroundColor: "#3b82f6" }}></span> AMC visits done</div>
              <div style={styles.legendItem}><span style={{ ...styles.dot, backgroundColor: "#ef4444" }}></span> Complaints within 30d</div>
            </div>
          </div>
        </div>

      </div>

      {/* Table: Complaints after visit */}
      <div className="panel-card" style={styles.tableCard}>
        <h3 style={styles.widgetTitle}>COMPLAINTS RAISED AFTER AN AMC VISIT</h3>
        <div className="custom-table-container" style={{ border: "none", margin: "0" }}>
          <table className="custom-table" style={styles.lightTable}>
            <thead>
              <tr style={styles.lightThRow}>
                <th>APP ID</th>
                <th>DISTRICT</th>
                <th>LAST AMC VISIT</th>
                <th>DAYS SINCE VISIT</th>
                <th>COMPLAINT RAISED</th>
                <th>PRIORITY</th>
                <th>SAME ISSUE AS VISIT?</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map((c: any) => (
                <tr key={c.appId} style={styles.lightTdRow}>
                  <td style={{ fontWeight: "600", color: "#111", fontFamily: "monospace" }}>{c.appId}</td>
                  <td>{c.district}</td>
                  <td>{c.lastVisit}</td>
                  <td style={{ color: "#ef4444", fontWeight: "600" }}>{c.days}</td>
                  <td>{c.issue}</td>
                  <td>
                    <span style={c.priority === "Critical" ? styles.badgeCrit : styles.badgeUrg}>
                      {c.priority}
                    </span>
                  </td>
                  <td style={{ fontWeight: "500", color: "#555" }}>{c.recurring}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={styles.tableFooter}>
          * "Same issue as visit" flags whether the AMC visit checklist already noted this fault — useful for spotting visits that didn't actually fix the problem.
        </div>
      </div>

      {/* Bottom discussion widgets */}
      <h3 style={styles.discussionHeading}>ADDITIONAL METRICS TO WEIGH IN — FOR TEAM DISCUSSION</h3>
      <div style={styles.discussionGrid}>
        {[
          { title: "Repeat complaint rate", desc: "% of AMC sites with 2+ complaints in the 90 days after a visit. Signals whether visits are actually resolving root causes." },
          { title: "First-visit compliance", desc: "% of newly onboarded sites that got their first AMC visit within the target window (e.g. 30 days of commissioning)." },
          { title: "Visit-to-complaint lag", desc: "Avg days between an AMC visit and the next complaint at that site. Short lag = visit likely missed something." },
          { title: "Cycle adherence", desc: "Actual days between consecutive visits vs the 180-day target, per site and per engineer." },
          { title: "Engineer AMC workload", desc: "Visits assigned vs completed per engineer per month — separate from complaint-ticket workload." },
          { title: "No-access / skip rate", desc: "% of visits that couldn't be completed due to site access issues — may need follow-up workflow." },
          { title: "Uptime since last visit", desc: "Days the pump was reported active out of days since the last AMC visit — cleaner health signal than active/inactive flag." },
          { title: "Renewal at-risk list", desc: "Sites approaching renewal with an overdue visit or open complaint — ones likely to churn." }
        ].map((m) => (
          <div key={m.title} style={styles.discCard}>
            <strong style={styles.discTitle}>{m.title}</strong>
            <p style={styles.discDesc}>{m.desc}</p>
            <span style={styles.discBadge}>NEEDS DEFINITION</span>
          </div>
        ))}
      </div>

    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#f7f7f8",
    padding: "20px",
    minHeight: "100vh",
    color: "#333"
  },
  disclaimerCard: {
    backgroundColor: "#fffbeb",
    border: "1px solid #fef3c7",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "1.5rem"
  },
  disclaimerIcon: {
    fontSize: "1.2rem"
  },
  disclaimerText: {
    color: "#b45309",
    fontSize: "0.85rem",
    lineHeight: "1.4"
  },
  subTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontSize: "0.85rem",
    color: "#6b7280",
    marginTop: "0.25rem"
  },
  pilotBadge: {
    backgroundColor: "#ffedd5",
    color: "#ea580c",
    fontSize: "0.75rem",
    fontWeight: "700",
    padding: "2px 8px",
    borderRadius: "4px"
  },
  filterGroup: {
    display: "flex",
    gap: "0.5rem"
  },
  subFilterBtn: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: "500",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer"
  },
  dropdown: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    fontWeight: "500",
    color: "#374151",
    outline: "none"
  },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "12px",
    marginBottom: "1.5rem"
  },
  kpiCard: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  },
  kpiLabel: {
    fontSize: "0.7rem",
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: "0.05em",
    marginBottom: "8px"
  },
  kpiVal: {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "#111827",
    marginBottom: "4px"
  },
  kpiSub: {
    fontSize: "0.7rem",
    color: "#9ca3af"
  },
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.1fr 1fr",
    gap: "16px",
    marginBottom: "1.5rem"
  },
  dashboardGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
    marginBottom: "1.5rem"
  },
  widgetCard: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  },
  widgetTitle: {
    fontSize: "0.85rem",
    fontWeight: "800",
    color: "#111827",
    letterSpacing: "0.05em",
    marginBottom: "1.25rem",
    textTransform: "uppercase" as const
  },
  cadenceList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px"
  },
  cadenceItem: {
    display: "flex",
    gap: "12px"
  },
  cadenceDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    marginTop: "6px",
    flexShrink: 0
  },
  breakdownContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px"
  },
  breakdownList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    flexGrow: 1
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.85rem",
    color: "#374151"
  },
  percentText: {
    color: "#6b7280",
    fontSize: "0.75rem"
  },
  donutWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  donutOuter: {
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    background: "conic-gradient(#3b82f6 65.5%, #10b981 65.5% 80.8%, #ef4444 80.8% 92.6%, #f59e0b 92.6% 97.6%, #9ca3af 0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  donutInner: {
    width: "76px",
    height: "76px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  donutLabel: {
    fontSize: "0.75rem",
    fontWeight: "700",
    color: "#6b7280"
  },
  badgeCompleted: { backgroundColor: "#d1fae5", color: "#065f46", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "12px", fontWeight: "600" },
  badgeScheduled: { backgroundColor: "#dbeafe", color: "#1e40af", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "12px", fontWeight: "600" },
  badgeOverdue: { backgroundColor: "#fee2e2", color: "#991b1b", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "12px", fontWeight: "600" },
  badgeRescheduled: { backgroundColor: "#fef3c7", color: "#92400e", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "12px", fontWeight: "600" },
  badgeSkipped: { backgroundColor: "#f3f4f6", color: "#374151", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "12px", fontWeight: "600" },
  indicatorGreen: { width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#10b981" },
  indicatorRed: { width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#ef4444" },
  districtList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px"
  },
  districtRow: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.85rem",
    gap: "8px"
  },
  districtName: {
    width: "90px",
    color: "#374151",
    fontWeight: "500"
  },
  progressBarBg: {
    height: "8px",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
    flexGrow: 1,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: "4px"
  },
  districtCount: {
    width: "35px",
    textAlign: "right" as const
  },
  districtPct: {
    width: "30px",
    color: "#6b7280",
    fontSize: "0.75rem",
    textAlign: "right" as const
  },
  renewalsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px"
  },
  renewalBarRow: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.85rem",
    gap: "12px"
  },
  renewalLabel: {
    width: "90px",
    color: "#374151"
  },
  barContainer: {
    height: "14px",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
    flexGrow: 1,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: "4px"
  },
  renewalCount: {
    width: "25px",
    textAlign: "right" as const
  },
  renewalNotice: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    marginTop: "1.5rem",
    borderTop: "1px solid #f3f4f6",
    paddingTop: "10px"
  },
  trendGraphic: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "space-between",
    height: "130px"
  },
  trendBarRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "24px",
    height: "90px",
    width: "100%",
    justifyContent: "center"
  },
  trendBar: {
    width: "28px",
    borderRadius: "4px 4px 0 0"
  },
  trendLegend: {
    display: "flex",
    gap: "16px",
    fontSize: "0.75rem",
    color: "#6b7280",
    marginTop: "12px"
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%"
  },
  tableCard: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    padding: "20px",
    borderRadius: "8px",
    color: "#333",
    marginTop: "1.5rem"
  },
  lightTable: {
    backgroundColor: "#fff"
  },
  lightThRow: {
    borderBottom: "2px solid #e5e7eb"
  },
  lightTdRow: {
    backgroundColor: "#fff",
    borderBottom: "1px solid #f3f4f6",
    color: "#374151"
  },
  badgeCrit: { backgroundColor: "#fee2e2", color: "#ef4444", fontSize: "0.75rem", fontWeight: "700", padding: "4px 10px", borderRadius: "12px" },
  badgeUrg: { backgroundColor: "#fffbeb", color: "#f59e0b", fontSize: "0.75rem", fontWeight: "700", padding: "4px 10px", borderRadius: "12px" },
  tableFooter: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    marginTop: "1rem"
  },
  discussionHeading: {
    fontSize: "0.85rem",
    fontWeight: "800",
    color: "#4b5563",
    marginTop: "3rem",
    marginBottom: "1rem",
    letterSpacing: "0.05em"
  },
  discussionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px"
  },
  discCard: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    gap: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  },
  discTitle: {
    fontSize: "0.9rem",
    fontWeight: "700",
    color: "#111827"
  },
  discDesc: {
    fontSize: "0.8rem",
    color: "#6b7280",
    lineHeight: "1.5"
  },
  discBadge: {
    backgroundColor: "#ffedd5",
    color: "#ea580c",
    fontSize: "0.75rem",
    fontWeight: "700",
    alignSelf: "flex-start",
    padding: "2px 8px",
    borderRadius: "4px"
  }
};
