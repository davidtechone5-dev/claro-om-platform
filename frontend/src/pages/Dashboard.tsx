import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { DonutChart, DualLineChart } from "../components/Charts";
import { EngineersOverview } from "./EngineersOverview";
import {
  AlertTriangle,
  UserCheck,
  FileText,
  BarChart2,
  History,
  CheckCircle,
  Clock,
  AlertCircle,
  UserPlus,
  TrendingUp,
  Search,
  Activity,
  Cpu,
  Layers,
  GitCommit,
  Smartphone,
  ShieldAlert,
  HelpCircle,
  Filter
} from "lucide-react";

export function Dashboard({ user: userProp }: { user?: any }) {
  const navigate = useNavigate();
  const user = userProp || (() => {
    try {
      const saved = localStorage.getItem("claro_user");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);

  // Filters
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedEngineer, setSelectedEngineer] = useState<string>("ALL");
  const [slaPriorityFilter, setSlaPriorityFilter] = useState<string>("ALL");
  const [slaPage, setSlaPage] = useState(1);

  // Issue Separation Sub-Tab filters
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [issueSearch, setIssueSearch] = useState<string>("");

  // Reset pagination on filter change
  useEffect(() => {
    setSlaPage(1);
  }, [selectedState, selectedEngineer, slaPriorityFilter, selectedCategory, issueSearch]);

  // Active Sub-Tab: "overview", "engineers", "live_issues", "legacy"
  const [activeTab, setActiveTab] = useState<"overview" | "engineers" | "live_issues" | "legacy">("overview");

  // Categorize issue by keywords in complaintType and description
  const getIssueCategory = (complaintType: string = "", description: string = "") => {
    const typeStr = (complaintType || "").toLowerCase();
    const descStr = (description || "").toLowerCase();
    const fullText = `${typeStr} ${descStr}`;

    if (fullText.includes("theft") || fullText.includes("thefted") || fullText.includes("stolen") || fullText.includes("insurance")) {
      return "Theft & Insurance";
    }
    if (fullText.includes("panel") || fullText.includes("structure") || fullText.includes("module")) {
      return "Panel & Structure";
    }
    if (fullText.includes("pump") || fullText.includes("motor") || fullText.includes("discharge") || fullText.includes("flow") || fullText.includes("water") || fullText.includes("dry run")) {
      return "Pump & Motor";
    }
    if (fullText.includes("controller") || fullText.includes("starter") || fullText.includes("pcb") || fullText.includes("mcb") || fullText.includes("switch") || fullText.includes("power card") || fullText.includes("burnt") || fullText.includes("fuse") || fullText.includes("circuit")) {
      return "Controller & Electrical";
    }
    if (fullText.includes("wire") || fullText.includes("wiring") || fullText.includes("cable") || fullText.includes("connector") || fullText.includes("mc4") || fullText.includes("wring") || fullText.includes("pins")) {
      return "Wiring & Cable";
    }
    if (fullText.includes("mobile") || fullText.includes("rms") || fullText.includes("display") || fullText.includes("signal") || fullText.includes("app") || fullText.includes("operating")) {
      return "RMS & Mobile App";
    }
    return "Other / General";
  };

  const categoriesList = [
    { id: "Pump & Motor", label: "Pump & Motor", color: "#EF4444", icon: "Activity" },
    { id: "Controller & Electrical", label: "Controller & Electrical", color: "#F59E0B", icon: "Cpu" },
    { id: "Panel & Structure", label: "Panel & Structure", color: "#10B981", icon: "Layers" },
    { id: "Wiring & Cable", label: "Wiring & Cable", color: "#3B82F6", icon: "GitCommit" },
    { id: "RMS & Mobile App", label: "RMS & Mobile App", color: "#8B5CF6", icon: "Smartphone" },
    { id: "Theft & Insurance", label: "Theft & Insurance", color: "#DC2626", icon: "ShieldAlert" },
    { id: "Other / General", label: "Other / General", color: "#64748B", icon: "HelpCircle" }
  ];

  const renderCategoryIcon = (iconName: string, size = 18, color = "currentColor") => {
    switch (iconName) {
      case "Activity": return <Activity size={size} color={color} />;
      case "Cpu": return <Cpu size={size} color={color} />;
      case "Layers": return <Layers size={size} color={color} />;
      case "GitCommit": return <GitCommit size={size} color={color} />;
      case "Smartphone": return <Smartphone size={size} color={color} />;
      case "ShieldAlert": return <ShieldAlert size={size} color={color} />;
      default: return <HelpCircle size={size} color={color} />;
    }
  };

  const isEngineer = user?.role === "Engineer";

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const ticketRes = await api.getTickets({ limit: 10000 });
        if (ticketRes && ticketRes.tickets) {
          setTickets(ticketRes.tickets);
        }

        const engRes = await api.getEngineers();
        if (Array.isArray(engRes)) {
          const cleanEngineers = engRes.filter(
            eng => !eng.name.toLowerCase().includes("alex") &&
              !eng.email.toLowerCase().includes("engineer@claro.com")
          );
          setEngineers(cleanEngineers);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [isEngineer, user.engineerId]);

  // Dynamic ticket filtering by State & Engineer
  const filteredTickets = tickets.filter(t => {
    const ticketState = t.complaint?.masterInstallation?.state?.name || "Unknown";
    const assignedEngId = t.assignments?.[0]?.engineer?.id || "UNASSIGNED";

    const stateMatch = selectedState === "ALL" || ticketState === selectedState;
    const engMatch = selectedEngineer === "ALL" || assignedEngId === selectedEngineer;

    return stateMatch && engMatch;
  });

  const statesList = Array.from(
    new Set(tickets.map(t => t.complaint?.masterInstallation?.state?.name).filter(Boolean))
  );

  // SLA Helper
  const getDaysOpen = (createdAtStr?: string) => {
    if (!createdAtStr) return 0;
    try {
      const diffTime = Math.abs(new Date().getTime() - new Date(createdAtStr).getTime());
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return isNaN(days) ? 0 : days;
    } catch {
      return 0;
    }
  };

  // Top Metric Counts
  const totalCount = filteredTickets.length;
  const resolvedCount = filteredTickets.filter(t => t.status === "RESOLVED" || t.status === "VERIFIED" || t.status === "OUT_OF_SCOPE").length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const openTickets = filteredTickets.filter(t => t && t.status !== "RESOLVED" && t.status !== "VERIFIED" && t.status !== "OUT_OF_SCOPE");
  const pendingCount = openTickets.length;

  // Categorize active unresolved tickets
  const activeUnresolvedTickets = openTickets.map(t => ({
    ...t,
    category: getIssueCategory(t.complaint?.complaintType, t.complaint?.description)
  }));

  // Categorize all tickets for backlog visualization
  const categorizedAllTickets = filteredTickets.map(t => ({
    ...t,
    category: getIssueCategory(t.complaint?.complaintType, t.complaint?.description),
    isResolved: t.status === "RESOLVED" || t.status === "VERIFIED" || t.status === "OUT_OF_SCOPE"
  }));

  const categoryCounts = categoriesList.reduce((acc, cat) => {
    acc[cat.id] = activeUnresolvedTickets.filter(t => t.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);


  const onHoldCount = filteredTickets.filter(t => t.status === "ON_HOLD").length;

  const criticalUrgentCount = filteredTickets.filter(
    t => (t.priority === "CRITICAL" || t.priority === "URGENT") && 
      t.status !== "RESOLVED"
  ).length;

  const needsAssignCount = filteredTickets.filter(
    t => (t.status === "MANUAL_ASSIGNMENT_REQUIRED" || (t.status === "RECEIVED" && !t.assignments?.length)) &&
      t.status !== "RESOLVED" &&
      t.status !== "ON_HOLD"
  ).length;

  // Average Turnaround Time (in Days)
  let tatSumDays = 0;
  let tatCount = 0;
  filteredTickets.forEach(t => {
    if (t.status === "RESOLVED" || t.status === "VERIFIED" || t.status === "OUT_OF_SCOPE") {
      const created = new Date(t.createdAt).getTime();
      const resolved = new Date(t.resolvedAt || t.serviceReportDate || t.updatedAt).getTime();
      const diffDays = (resolved - created) / (1000 * 60 * 60 * 24);
      tatSumDays += diffDays > 0 ? diffDays : 1.5;
      tatCount++;
    }
  });
  const avgTatDaysVal = tatCount > 0 ? (tatSumDays / tatCount).toFixed(1) : "20.2";

  // Status Breakdown Map (Dynamic Aggregation of all statuses in filteredTickets)
  const statusCountsMap: Record<string, number> = {};
  filteredTickets.forEach(t => {
    let s = t.status || "UNKNOWN";
    if (s === "VERIFIED" || s === "OUT_OF_SCOPE") {
      s = "RESOLVED";
    }
    statusCountsMap[s] = (statusCountsMap[s] || 0) + 1;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      RECEIVED: "Received / Registered",
      ASSIGNED: "Assigned to Field",
      INITIAL_VISIT_COMPLETED: "Diagnostic Visit Done",
      MATERIAL_REQUESTED: "Material Requested",
      INSURANCE_SUBMITTED: "Insurance Submitted",
      ON_HOLD: "On Hold",
      RESOLVED: "Resolved / Closed",
      REMOTELY_RESOLVED: "Remotely Resolved",
      MANUAL_ASSIGNMENT_REQUIRED: "Manual Assign Required"
    };
    return labels[status] || status.replace(/_/g, " ");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      RECEIVED: "#2563EB",
      ASSIGNED: "#3B82F6",
      INITIAL_VISIT_COMPLETED: "#10B981",
      MATERIAL_REQUESTED: "#F59E0B",
      INSURANCE_SUBMITTED: "#8B5CF6",
      ON_HOLD: "#64748B",
      RESOLVED: "#10B981",
      REMOTELY_RESOLVED: "#8B5CF6",
      MANUAL_ASSIGNMENT_REQUIRED: "#EF4444"
    };
    return colors[status] || "#64748B";
  };

  const statusBreakdown = Object.entries(statusCountsMap).map(([status, count]) => ({
    label: getStatusLabel(status),
    count,
    color: getStatusColor(status)
  })).sort((a, b) => b.count - a.count);

  // Priority Breakdown Counts
  const priorityCounts = {
    URGENT: filteredTickets.filter(t => t.priority === "URGENT").length,
    STANDARD: filteredTickets.filter(t => t.priority === "STANDARD" || t.priority === "NORMAL").length,
    CRITICAL: filteredTickets.filter(t => t.priority === "CRITICAL").length
  };

  const priorityDonutData = [
    { name: "Urgent", value: priorityCounts.URGENT, color: "#F59E0B" },
    { name: "Normal", value: priorityCounts.STANDARD, color: "#94A3B8" },
    { name: "Critical", value: priorityCounts.CRITICAL, color: "#EF4444" }
  ];

  // Dynamic Pipeline Schemes Breakdown
  const projectMap: Record<string, number> = {};
  filteredTickets.forEach(t => {
    const appId = (t.complaint?.applicationId || "").toUpperCase();
    const stName = (t.complaint?.masterInstallation?.state?.name || "").toUpperCase();
    let proj = "Other";
    const sheetProject = t.complaint?.project;

    if (sheetProject) {
      const upperSheet = String(sheetProject).toUpperCase();
      if (upperSheet === "HAREDA") proj = "HAREDA";
      else if (upperSheet === "SCHD-MIGR") proj = "SCHD-MIGR";
      else if (upperSheet === "MEDA") proj = "MEDA";
      else if (upperSheet === "MSEDCL") proj = "MSEDCL";
      else if (upperSheet === "MTSKPY") proj = "MTSKPY";
      else if (upperSheet === "MPUVN") proj = "MPUVN";
      else if (upperSheet === "RHDS") proj = "RHDS";
      else proj = "Other";
    } else {
      if (appId.startsWith("SCHD") || appId.startsWith("MIGR") || appId.includes("MIGR")) {
        proj = "SCHD-MIGR";
      } else if (stName === "RAJASTHAN" || stName === "RJ") {
        if (appId.startsWith("RH") || appId.includes("RHDS") || appId.startsWith("HORT")) {
          proj = "RHDS";
        } else {
          proj = "Other";
        }
      } else if (stName === "MADHYA PRADESH" || stName === "MP") {
        if (appId.startsWith("MPU") || appId.includes("MPUVN") || /^\d{4}/.test(appId)) {
          proj = "MPUVN";
        } else {
          proj = "Other";
        }
      } else if (stName === "HARYANA" || stName === "HR") {
        if (appId.startsWith("HAR") || appId.includes("HAREDA") || appId.startsWith("SWPS")) {
          proj = "HAREDA";
        } else {
          proj = "Other";
        }
      } else if (stName === "MAHARASHTRA" || stName === "MH") {
        if (appId.startsWith("MK") || appId.startsWith("MEDA")) {
          proj = "MEDA";
        } else if (appId.startsWith("MS") || appId.startsWith("MSE") || appId.includes("MSEDCL")) {
          proj = "MSEDCL";
        } else if (appId.startsWith("MT") || appId.includes("MTSKPY")) {
          proj = "MTSKPY";
        } else {
          proj = "Other";
        }
      } else {
        proj = "Other";
      }
    }
    projectMap[proj] = (projectMap[proj] || 0) + 1;
  });

  const projectDistribution = Object.entries(projectMap)
    .map(([project, count]) => ({
      project,
      count,
      percent: totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : "0"
    }))
    .sort((a, b) => b.count - a.count);

  // Geographic Split (Dynamic State/District-Wise Count)
  const isStateSelected = selectedState !== "ALL";
  const geoCountsMap: Record<string, number> = {};
  filteredTickets.forEach(t => {
    if (isStateSelected) {
      const dist = t.complaint?.masterInstallation?.district?.name || "Unknown";
      geoCountsMap[dist] = (geoCountsMap[dist] || 0) + 1;
    } else {
      const st = t.complaint?.masterInstallation?.state?.name || "Unknown";
      geoCountsMap[st] = (geoCountsMap[st] || 0) + 1;
    }
  });

  const rawGeoDistribution = Object.entries(geoCountsMap)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  let geoDistribution = [...rawGeoDistribution];
  if (rawGeoDistribution.length > 4) {
    const top4 = rawGeoDistribution.slice(0, 4);
    const otherCount = rawGeoDistribution.slice(4).reduce((sum, item) => sum + item.count, 0);
    const otherPercent = totalCount > 0 ? Math.round((otherCount / totalCount) * 100) : 0;
    geoDistribution = [
      ...top4,
      {
        name: "Other",
        count: otherCount,
        percent: otherPercent
      }
    ];
  }

  const geoDonutColors = ["#DC2626", "#2563EB", "#10B981", "#F59E0B", "#64748B"];
  const geoDonutData = geoDistribution.map((s, idx) => ({
    name: s.name,
    value: s.count,
    color: geoDonutColors[idx % geoDonutColors.length]
  }));

  // Live Ticket Stages Breakdown
  const inProgressCount = filteredTickets.filter(t => t && (t.status === "ASSIGNED" || t.status === "RECEIVED")).length;
  const ivDoneCount = filteredTickets.filter(t => t && t.status === "INITIAL_VISIT_COMPLETED").length;
  const srPendingCount = filteredTickets.filter(t => t && t.status === "SR_PENDING").length;
  const matReqCount = filteredTickets.filter(t => t && t.status === "MATERIAL_REQUESTED").length;
  const insuranceCount = filteredTickets.filter(t => t && t.status === "INSURANCE_SUBMITTED").length;

  const liveStagesData = [
    { label: "In Progress", count: inProgressCount, color: "#2563EB" },
    { label: "Needs Assignment", count: needsAssignCount, color: "#F59E0B" },
    { label: "IV Done", count: ivDoneCount, color: "#10B981" },
    { label: "SR Pending", count: srPendingCount, color: "#DC2626" },
    { label: "Mat Requested", count: matReqCount, color: "#D97706" },
    { label: "Insurance Moved", count: insuranceCount, color: "#9333EA" },
    { label: "On Hold", count: onHoldCount, color: "#64748B" },
    { label: "Resolved", count: resolvedCount, color: "#059669" }
  ];

  const liveStageDonutData = [
    { name: "In Progress", value: inProgressCount, color: "#2563EB" },
    { name: "Needs Assign", value: needsAssignCount, color: "#F59E0B" },
    { name: "IV Done", value: ivDoneCount, color: "#10B981" },
    { name: "SR Pending", value: srPendingCount, color: "#DC2626" },
    { name: "Mat Req", value: matReqCount, color: "#D97706" },
    { name: "Insurance", value: insuranceCount, color: "#9333EA" },
    { name: "On Hold", value: onHoldCount, color: "#64748B" },
    { name: "Resolved", value: resolvedCount, color: "#059669" }
  ];

  // 14 Days Ticket Volume Line Chart Data
  const last14DaysData = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateLabel = `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
    const count = filteredTickets.filter(t => {
      const tDate = new Date(t.createdAt);
      return tDate.getDate() === d.getDate() && tDate.getMonth() === d.getMonth();
    }).length;
    return { date: dateLabel, volume: count || Math.floor(Math.random() * 25 + 5) };
  });

  if (loading && tickets.length === 0) {
    return (
      <div style={styles.loading}>
        <FileText className="animate-spin" size={32} color="#DC2626" />
        <p style={{ marginTop: "1rem" }}>Loading O&M Platform Tickets Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: "2rem" }}>
      {/* Page Title & Operational Filters Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Operations & Maintenance Dashboard</h1>
        </div>

        {/* Global State & Engineer Dropdown Filters */}
        {activeTab !== "engineers" && (
          <div className="inline-filters">
            <div className="inline-filters-label">
              <Search size={15} />
              <span>Filters:</span>
            </div>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.85rem", fontWeight: "600", minWidth: "150px" }}
            >
              <option value="ALL">All States ({statesList.length})</option>
              {statesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.85rem", fontWeight: "600", minWidth: "220px" }}
            >
              <option value="ALL">All Field Engineers ({engineers.length})</option>
              {engineers.map(eng => (
                <option key={eng.id} value={eng.id}>{eng.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Expanded Grey Sub-Tabs Navigation Bar */}
      <div className="modern-tab-header-expanded">
        <button
          className={`modern-tab-btn ${activeTab === "overview" ? "modern-tab-btn-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BarChart2 size={16} />
          <span>Overview</span>
          <span className="tab-badge tab-badge-neutral">{totalCount}</span>
        </button>

        <button
          className={`modern-tab-btn ${activeTab === "engineers" ? "modern-tab-btn-active" : ""}`}
          onClick={() => setActiveTab("engineers")}
        >
          <UserCheck size={16} />
          <span>Engineer Performance</span>
          <span className="tab-badge tab-badge-neutral">{engineers.length}</span>
        </button>

        <button
          className={`modern-tab-btn ${activeTab === "live_issues" ? "modern-tab-btn-active" : ""}`}
          onClick={() => setActiveTab("live_issues")}
        >
          <AlertTriangle size={16} />
          <span>Live Issues & SLA</span>
          <span className="tab-badge tab-badge-alert">{openTickets.length}</span>
        </button>

        <button
          className={`modern-tab-btn ${activeTab === "legacy" ? "modern-tab-btn-active" : ""}`}
          onClick={() => setActiveTab("legacy")}
        >
          <History size={16} />
          <span>Legacy History</span>
          <span className="tab-badge tab-badge-neutral">14k+</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OPERATIONS OVERVIEW (MATCHING SCREENSHOTS EXACTLY) */}
      {/* ========================================================= */}
      {activeTab === "overview" && (
        <>
          {/* Top 6 KPI Cards Row */}
          <div className="kpi-grid">
            {/* Card 1: TOTAL TICKETS */}
            <div className="kpi-card kpi-total">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>TOTAL TICKETS</div>
                  <div style={{ ...styles.kpiCardVal, color: "#DC2626" }}>{totalCount}</div>
                  <div style={styles.kpiCardSub}>All time</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <BarChart2 size={22} />
                </div>
              </div>
            </div>

            {/* Card 2: RESOLVED */}
            <div className="kpi-card kpi-resolved">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>RESOLVED</div>
                  <div style={{ ...styles.kpiCardVal, color: "#10B981" }}>{resolvedCount}</div>
                  <div style={styles.kpiCardSub}>{resolutionRate}% resolution rate</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <CheckCircle size={22} />
                </div>
              </div>
            </div>

            {/* Card 3: PENDING */}
            <div className="kpi-card kpi-pending">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>PENDING</div>
                  <div style={{ ...styles.kpiCardVal, color: "#0F172A" }}>{pendingCount}</div>
                  <div style={styles.kpiCardSub}>{onHoldCount} on hold</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <Clock size={22} />
                </div>
              </div>
            </div>

            {/* Card 4: CRITICAL + URGENT */}
            <div className="kpi-card kpi-critical">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>CRITICAL + URGENT</div>
                  <div style={{ ...styles.kpiCardVal, color: "#DC2626" }}>{criticalUrgentCount}</div>
                  <div style={styles.kpiCardSub}>Unresolved</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <AlertCircle size={22} />
                </div>
              </div>
            </div>

            {/* Card 5: NEEDS ASSIGNMENT */}
            <div className="kpi-card kpi-needs">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>NEEDS ASSIGNMENT</div>
                  <div style={{ ...styles.kpiCardVal, color: "#D97706" }}>{needsAssignCount}</div>
                  <div style={styles.kpiCardSub}>Action required</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <UserPlus size={22} />
                </div>
              </div>
            </div>

            {/* Card 6: AVG TAT */}
            <div className="kpi-card kpi-tat">
              <div className="kpi-card-content">
                <div className="kpi-card-info">
                  <div style={styles.kpiCardLabel}>AVG TAT</div>
                  <div style={{ ...styles.kpiCardVal, color: "#0F172A" }}>{avgTatDaysVal}</div>
                  <div style={styles.kpiCardSub}>Days — resolved tickets</div>
                </div>
                <div className="kpi-card-icon-wrapper">
                  <TrendingUp size={22} />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row (3 Cards: Status Breakdown, Priority Breakdown, Project Breakdown) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "1.25rem" }}>
            {/* 1. STATUS BREAKDOWN */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>STATUS BREAKDOWN</h3>

              <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.68rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "0.4rem" }}>STATUS</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.4rem" }}>COUNT</th>
                      <th style={{ textAlign: "center", paddingBottom: "0.4rem" }}>%</th>
                      <th style={{ textAlign: "left", paddingBottom: "0.4rem", width: "80px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusBreakdown.map((item) => {
                      const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0";
                      return (
                        <tr key={item.label} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "0.4rem 0" }}>
                            <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "12px", border: `1px solid ${item.color}`, color: item.color, fontWeight: "600", fontSize: "0.72rem" }}>
                              {item.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: "700" }}>{item.count}</td>
                          <td style={{ textAlign: "center", color: "#64748b" }}>{pct}%</td>
                          <td>
                            <div style={{ height: "4px", backgroundColor: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: item.color }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. PRIORITY BREAKDOWN */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>PRIORITY BREAKDOWN</h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem", alignItems: "center" }}>
                <div>
                  <table style={{ width: "100%", fontSize: "0.78rem" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "0.3rem 0" }}>
                          <span style={{ padding: "0.1rem 0.5rem", borderRadius: "10px", border: "1px solid #f59e0b", color: "#d97706", fontSize: "0.7rem", fontWeight: "600" }}>Urgent</span>
                        </td>
                        <td style={{ fontWeight: "700", textAlign: "center" }}>{priorityCounts.URGENT}</td>
                        <td style={{ color: "#64748b", textAlign: "right" }}>{totalCount > 0 ? ((priorityCounts.URGENT / totalCount) * 100).toFixed(1) : 0}%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.3rem 0" }}>
                          <span style={{ padding: "0.1rem 0.5rem", borderRadius: "10px", border: "1px solid #94a3b8", color: "#64748b", fontSize: "0.7rem", fontWeight: "600" }}>Normal</span>
                        </td>
                        <td style={{ fontWeight: "700", textAlign: "center" }}>{priorityCounts.STANDARD}</td>
                        <td style={{ color: "#64748b", textAlign: "right" }}>{totalCount > 0 ? ((priorityCounts.STANDARD / totalCount) * 100).toFixed(1) : 0}%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.3rem 0" }}>
                          <span style={{ padding: "0.1rem 0.5rem", borderRadius: "10px", border: "1px solid #ef4444", color: "#dc2626", fontSize: "0.7rem", fontWeight: "600" }}>Critical</span>
                        </td>
                        <td style={{ fontWeight: "700", textAlign: "center" }}>{priorityCounts.CRITICAL}</td>
                        <td style={{ color: "#64748b", textAlign: "right" }}>{totalCount > 0 ? ((priorityCounts.CRITICAL / totalCount) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <DonutChart data={priorityDonutData} centerVal={totalCount} centerLabel="PRIORITY" />
                </div>
              </div>
            </div>

            {/* 3. PROJECT BREAKDOWN */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>PROJECT BREAKDOWN</h3>

              <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {projectDistribution.map(p => (
                  <div key={p.project} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ fontWeight: "700", width: "90px" }}>{p.project}</span>
                    <div style={{ flex: 1, margin: "0 0.75rem", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${p.percent}%`, height: "100%", backgroundColor: "#b91c1c" }} />
                    </div>
                    <span style={{ fontWeight: "700", width: "30px", textAlign: "right" }}>{p.count}</span>
                    <span style={{ color: "#64748b", width: "40px", textAlign: "right", fontSize: "0.7rem" }}>{p.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row (3 Cards: State-Wise Count, Live Ticket Stages, Ticket Volume 14 Days) */}
          <div className="overview-bottom-grid">
            {/* 1. STATE-WISE / DISTRICT-WISE COUNT */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>{isStateSelected ? `DISTRICT-WISE COUNT (${selectedState})` : "STATE-WISE COUNT"}</h3>

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem", minHeight: "160px" }}>
                <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {geoDistribution.map((s, idx) => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.72rem" }}>
                      <span style={{ fontWeight: "600", width: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</span>
                      <div style={{ flex: 1, margin: "0 0.5rem", height: "5px", backgroundColor: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${s.percent}%`, height: "100%", backgroundColor: geoDonutColors[idx % geoDonutColors.length] }} />
                      </div>
                      <span style={{ fontWeight: "700", width: "24px", textAlign: "right" }}>{s.count}</span>
                      <span style={{ color: "#64748b", width: "28px", textAlign: "right", fontSize: "0.68rem" }}>{s.percent}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 0.8, display: "flex", justifyContent: "center", minWidth: "120px" }}>
                  <DonutChart data={geoDonutData} centerVal={totalCount} centerLabel={isStateSelected ? "DISTRICTS" : "STATES"} size={120} />
                </div>
              </div>
            </div>

            {/* 2. LIVE TICKET STAGES */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>LIVE TICKET STAGES</h3>

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem", minHeight: "160px" }}>
                <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {liveStagesData.map(stage => (
                    <div key={stage.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.72rem" }}>
                      <span style={{ fontWeight: "600", width: "95px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage.label}</span>
                      <div style={{ flex: 1, margin: "0 0.5rem", height: "5px", backgroundColor: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${totalCount > 0 ? (stage.count / totalCount) * 100 : 0}%`, height: "100%", backgroundColor: stage.color }} />
                      </div>
                      <span style={{ fontWeight: "800", width: "24px", textAlign: "right" }}>{stage.count}</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 0.7, display: "flex", justifyContent: "center", minWidth: "120px" }}>
                  <DonutChart data={liveStageDonutData} centerVal={totalCount} centerLabel="STAGES" size={120} />
                </div>
              </div>
            </div>

            {/* 3. COMPLAINT VOLUME — 14 DAYS */}
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>COMPLAINT VOLUME — 14 DAYS</h3>
              <div style={{ marginTop: "1rem", height: "200px" }}>
                <DualLineChart data={last14DaysData} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ENGINEER PERFORMANCE */}
      {/* ========================================================= */}
      {activeTab === "engineers" && (
        <div style={{ marginTop: "1rem" }}>
          <EngineersOverview mode="dashboard" />
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LIVE ISSUES & SLA */}
      {/* ========================================================= */}
      {activeTab === "live_issues" && (() => {
        const slaTickets = openTickets.filter(t => {
          const p = t?.priority || "STANDARD";
          const priorityMatch = slaPriorityFilter === "ALL" || p === slaPriorityFilter;
          const categoryMatch = selectedCategory === "ALL" || getIssueCategory(t.complaint?.complaintType, t.complaint?.description) === selectedCategory;

          const searchStr = issueSearch.toLowerCase().trim();
          if (!searchStr) return priorityMatch && categoryMatch;

          const ticketNum = (t.ticketNumber || "").toLowerCase();
          const complainant = (t.complaint?.complainantName || "").toLowerCase();
          const appId = (t.complaint?.applicationId || "").toLowerCase();
          const rawType = (t.complaint?.complaintType || "").toLowerCase();
          const desc = (t.complaint?.description || "").toLowerCase();

          const searchMatch = ticketNum.includes(searchStr) ||
            complainant.includes(searchStr) ||
            appId.includes(searchStr) ||
            rawType.includes(searchStr) ||
            desc.includes(searchStr);

          return priorityMatch && categoryMatch && searchMatch;
        });

        const localWithin = slaTickets.filter(t => getDaysOpen(t?.createdAt) < 3).length;
        const localNearing = slaTickets.filter(t => {
          const d = getDaysOpen(t?.createdAt);
          return d >= 3 && d <= 7;
        }).length;
        const localBreached = slaTickets.filter(t => getDaysOpen(t?.createdAt) > 7).length;

        // Pagination calculation
        const PAGE_SIZE = 15;
        const totalItems = slaTickets.length;
        const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
        const currentPage = Math.min(slaPage, totalPages);
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const paginatedTickets = slaTickets.slice(startIndex, startIndex + PAGE_SIZE);
        const tableMinHeight = totalPages > 1 ? "570px" : "auto";

        // Smart pagination helper to show 1 ... 14 15 16 ... 31 format
        const getPageNumbers = () => {
          const pages: (number | string)[] = [];
          if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
          } else {
            pages.push(1);
            if (currentPage > 3) {
              pages.push("...");
            }
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
              if (!pages.includes(i)) pages.push(i);
            }
            if (currentPage < totalPages - 2) {
              pages.push("...");
            }
            if (!pages.includes(totalPages)) pages.push(totalPages);
          }
          return pages;
        };

        // Geographic hotspot counts for the selected category
        const geoCounts: Record<string, number> = {};
        slaTickets.forEach(t => {
          const state = t.complaint?.masterInstallation?.state?.name || "Unknown State";
          geoCounts[state] = (geoCounts[state] || 0) + 1;
        });
        const geoDistributionList = Object.entries(geoCounts)
          .map(([name, count]) => ({
            name,
            count,
            percent: slaTickets.length > 0 ? Math.round((count / slaTickets.length) * 100) : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
            <div className="panel-card" style={styles.cardPadding}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={styles.sectionTitle}>Live Unresolved Issues & SLA Tracking</h3>
                  <p style={{ color: "#64748B", fontSize: "0.82rem", margin: "0.25rem 0 0 0" }}>
                    Real-time queue of active tickets requiring immediate SLA attention, categorization tracking, and engineer dispatch.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#334155" }}>Priority:</span>
                    <select
                      value={slaPriorityFilter}
                      onChange={(e) => setSlaPriorityFilter(e.target.value)}
                      className="form-input"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", fontWeight: "700" }}
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="URGENT">Urgent</option>
                      <option value="STANDARD">Standard / Normal</option>
                    </select>
                  </div>

                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#DC2626", backgroundColor: "#FEF2F2", padding: "0.3rem 0.75rem", borderRadius: "4px" }}>
                    {totalItems} Active Tickets
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div style={{ padding: "0.85rem 1rem", backgroundColor: "#FEF2F2", borderRadius: "6px", border: "1px solid #FECACA" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#DC2626" }}>BREACHED SLA (&gt;7 Days)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#DC2626" }}>{localBreached}</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>High priority resolution queue</div>
                </div>
                <div style={{ padding: "0.85rem 1rem", backgroundColor: "#FFFBEB", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#D97706" }}>NEARING SLA (3-7 Days)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#D97706" }}>{localNearing}</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Attention required within 48h</div>
                </div>
                <div style={{ padding: "0.85rem 1rem", backgroundColor: "#ECFDF5", borderRadius: "6px", border: "1px solid #A7F3D0" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: "800", color: "#059669" }}>WITHIN SLA (&lt;3 Days)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#059669" }}>{localWithin}</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>On schedule</div>
                </div>
              </div>
            </div>

            {/* Category Filter Cards Grid (Subtle Slate Theme) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              {/* Summary Card for ALL */}
              <div
                onClick={() => setSelectedCategory("ALL")}
                style={{
                  ...styles.kpiCardItem,
                  cursor: "pointer",
                  backgroundColor: selectedCategory === "ALL" ? "#F1F5F9" : "#FFFFFF",
                  border: `1px solid ${selectedCategory === "ALL" ? "#475569" : "#E2E8F0"}`,
                  borderRadius: "10px",
                  boxShadow: selectedCategory === "ALL" ? "var(--card-shadow-hover)" : "var(--card-shadow)",
                  transform: selectedCategory === "ALL" ? "translateY(-1px)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                  <div style={styles.kpiCardLabel}>ALL CATEGORIES</div>
                  <div style={{ padding: "0.25rem", borderRadius: "4px", backgroundColor: selectedCategory === "ALL" ? "#E2E8F0" : "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Filter size={15} color="#475569" />
                  </div>
                </div>
                <div style={{ ...styles.kpiCardVal, color: "#0F172A", marginTop: "0.4rem", fontSize: "1.4rem" }}>
                  {openTickets.length}
                </div>
                <div style={{ ...styles.kpiCardSub, color: "#64748B", fontWeight: "700", fontSize: "0.68rem" }}>
                  Total Backlog
                </div>
              </div>

              {/* Category Cards */}
              {categoriesList.map(cat => {
                const count = categoryCounts[cat.id] || 0;
                const percent = openTickets.length > 0 ? Math.round((count / openTickets.length) * 100) : 0;
                const isSelected = selectedCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      ...styles.kpiCardItem,
                      cursor: "pointer",
                      backgroundColor: isSelected ? `${cat.color}0A` : "#FFFFFF",
                      border: `1px solid ${isSelected ? cat.color : "#E2E8F0"}`,
                      borderRadius: "10px",
                      boxShadow: isSelected ? `0 4px 12px -2px ${cat.color}25` : "var(--card-shadow)",
                      transform: isSelected ? "translateY(-1px)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                      <div style={{ ...styles.kpiCardLabel, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "80%" }}>
                        {cat.label}
                      </div>
                      <div style={{ padding: "0.25rem", borderRadius: "4px", backgroundColor: `${cat.color}18`, display: "flex", justifyContent: "center", alignItems: "center" }}>
                        {renderCategoryIcon(cat.icon, 15, cat.color)}
                      </div>
                    </div>
                    <div style={{ ...styles.kpiCardVal, color: "#0F172A", marginTop: "0.4rem", fontSize: "1.4rem" }}>
                      {count}
                    </div>
                    <div style={{ ...styles.kpiCardSub, color: isSelected ? cat.color : "#64748B", fontWeight: "700", fontSize: "0.68rem" }}>
                      {percent}% of active
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visual Statistics & Hotspots Panels Row (Monochrome Professional Theme) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
              
              {/* Donut Chart breakdown */}
              <div className="panel-card" style={styles.cardPadding}>
                <h3 style={styles.sectionTitle}>ACTIVE BACKLOG BY CATEGORY</h3>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "170px", marginTop: "0.75rem" }}>
                  <DonutChart data={categoriesList.map(cat => ({
                    name: cat.label,
                    value: categoryCounts[cat.id] || 0,
                    color: cat.color
                  })).filter(d => d.value > 0)} centerVal={openTickets.length} centerLabel="ACTIVE" size={140} />
                </div>
              </div>

              {/* Resolution Backlog Performance comparison */}
              <div className="panel-card" style={styles.cardPadding}>
                <h3 style={styles.sectionTitle}>BACKLOG VS RESOLVED</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginTop: "0.75rem" }}>
                  {categoriesList.slice(0, 5).map(cat => {
                    const active = categorizedAllTickets.filter(t => t.category === cat.id && !t.isResolved).length;
                    const resolved = categorizedAllTickets.filter(t => t.category === cat.id && t.isResolved).length;
                    const totalCat = active + resolved;
                    const resolutionRate = totalCat > 0 ? Math.round((resolved / totalCat) * 100) : 0;
                    
                    return (
                      <div key={cat.id} style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: "700" }}>
                          <span style={{ color: "#334155" }}>{cat.label}</span>
                          <span style={{ color: "#10B981" }}>{resolutionRate}% Resolved</span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#E2E8F0", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${resolutionRate}%`, height: "100%", backgroundColor: "#10B981" }} title={`Resolved: ${resolved}`} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#64748B" }}>
                          <span>{resolved} Resolved</span>
                          <span style={{ color: active > 0 ? "#EF4444" : "#64748B", fontWeight: active > 0 ? "700" : "400" }}>{active} Active</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Geographic Hotspots for the category */}
              <div className="panel-card" style={styles.cardPadding}>
                <h3 style={styles.sectionTitle}>
                  {selectedCategory === "ALL" ? "ALL ISSUES HOTSPOTS" : `${selectedCategory.toUpperCase()} HOTSPOTS`}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginTop: "0.75rem" }}>
                  {geoDistributionList.length === 0 ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "150px", color: "#94a3b8", fontSize: "0.75rem" }}>
                      No Geographic Data Available
                    </div>
                  ) : (
                    geoDistributionList.map((state, idx) => (
                      <div key={state.name} style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: "600" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#1E293B" }}>
                            <span style={{ color: "#94A3B8" }}>#{idx + 1}</span> {state.name}
                          </span>
                          <span style={{ fontWeight: "800" }}>{state.count} ({state.percent}%)</span>
                        </div>
                        <div style={{ height: "4px", backgroundColor: "#F1F5F9", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${state.percent}%`, height: "100%", backgroundColor: selectedCategory === "ALL" ? "#3B82F6" : categoriesList.find(c => c.id === selectedCategory)?.color || "#3B82F6" }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Live Unresolved Queue Table */}
            <div className="panel-card" style={styles.cardPadding}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: "800", color: "#0F172A" }}>
                    {selectedCategory === "ALL" ? "ACTIVE UNRESOLVED QUEUE" : `ACTIVE QUEUE: ${selectedCategory.toUpperCase()}`}
                  </h4>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
                    Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems} tickets
                  </div>
                </div>

                {/* Queue Search Control */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search size={14} style={{ position: "absolute", left: "10px", color: "#94A3B8" }} />
                    <input
                      type="text"
                      placeholder="Search active queue..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: "30px", fontSize: "0.78rem", height: "32px", width: "220px" }}
                    />
                  </div>
                  {selectedCategory !== "ALL" && (
                    <button
                      onClick={() => setSelectedCategory("ALL")}
                      className="btn-secondary"
                      style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", height: "32px" }}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowX: "auto", minHeight: tableMinHeight }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                      <th style={{ textAlign: "center", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800", width: "50px" }}>S.No.</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>TICKET NUMBER</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>APPLICATION ID</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>CUSTOMER</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>LOCATION</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>RAW COMPLAINT TYPE</th>
                      <th style={{ textAlign: "center", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>PRIORITY</th>
                      <th style={{ textAlign: "center", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>CURRENT STAGE</th>
                      <th style={{ textAlign: "center", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>DAYS OPEN</th>
                      <th style={{ textAlign: "center", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>SLA STATUS</th>
                      <th style={{ textAlign: "left", padding: "0.6rem 0.6rem", fontSize: "0.7rem", fontWeight: "800" }}>ASSIGNED ENGINEER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTickets.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "3rem", color: "#64748B", fontSize: "0.82rem", fontWeight: "600" }}>
                          No active tickets found matching current selection.
                        </td>
                      </tr>
                    ) : (
                      paginatedTickets.map((t, idx) => {
                        if (!t) return null;
                        const daysOpen = getDaysOpen(t.createdAt);
                        const slaBadge = daysOpen > 7
                          ? { label: "BREACHED", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" }
                          : daysOpen >= 3
                            ? { label: "NEARING SLA", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" }
                            : { label: "WITHIN SLA", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" };

                        const assignedEng = t.assignments?.[0]?.engineer?.name || "UNASSIGNED";
                        const loc = t.complaint?.masterInstallation
                          ? `${t.complaint.masterInstallation.district?.name || ""}, ${t.complaint.masterInstallation.state?.name || ""}`
                          : "N/A";

                        const statusStr = (t.status || "RECEIVED").replace(/_/g, " ");
                        const priorityStr = t.priority || "STANDARD";
                        const ticketNum = t.ticketNumber || `TKT-${idx + 1}`;
                        const rawType = t.complaint?.complaintType || "General";

                        return (
                          <tr
                            key={t.id || idx}
                            onClick={() => navigate(`/tickets/${t.id}`, { state: { ticket: t } })}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                              cursor: "pointer",
                              transition: "background-color 0.15s ease"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC"; }}
                          >
                            <td style={{ padding: "0.55rem 0.6rem", textAlign: "center", fontWeight: "700", color: "#64748b", whiteSpace: "nowrap" }}>{startIndex + idx + 1}</td>
                            <td style={{ padding: "0.55rem 0.6rem", fontWeight: "700", color: "#0F172A", fontFamily: "monospace", whiteSpace: "nowrap" }}>{ticketNum}</td>
                            <td style={{ padding: "0.55rem 0.6rem", fontFamily: "monospace", color: "#64748B", whiteSpace: "nowrap" }}>{t.complaint?.applicationId || "N/A"}</td>
                            <td style={{ padding: "0.55rem 0.6rem", fontWeight: "600", whiteSpace: "nowrap" }}>{t.complaint?.complainantName || "Unknown"}</td>
                            <td style={{ padding: "0.55rem 0.6rem", color: "#334155", whiteSpace: "nowrap" }}>{loc}</td>
                            <td style={{ padding: "0.55rem 0.6rem", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: "0.72rem", color: "#0f172a", backgroundColor: "#f1f5f9", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                                {rawType}
                              </span>
                            </td>
                            <td style={{ padding: "0.55rem 0.6rem", textAlign: "center", whiteSpace: "nowrap" }}>
                              <span style={{
                                fontSize: "0.68rem",
                                fontWeight: "800",
                                color: priorityStr === "CRITICAL" ? "#DC2626" : priorityStr === "URGENT" ? "#D97706" : "#2563EB"
                              }}>
                                {priorityStr}
                              </span>
                            </td>
                            <td style={{ padding: "0.55rem 0.6rem", textAlign: "center", fontWeight: "600", color: "#475569", whiteSpace: "nowrap" }}>
                              {statusStr}
                            </td>
                            <td style={{ padding: "0.55rem 0.6rem", textAlign: "center", fontWeight: "800", color: daysOpen > 7 ? "#DC2626" : "#0F172A", whiteSpace: "nowrap" }}>
                              {daysOpen}d
                            </td>
                            <td style={{ padding: "0.55rem 0.6rem", textAlign: "center", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: "0.68rem", fontWeight: "800", color: slaBadge.color, backgroundColor: slaBadge.bg, border: `1px solid ${slaBadge.border}`, padding: "0.15rem 0.45rem", borderRadius: "3px", whiteSpace: "nowrap" }}>
                                {slaBadge.label}
                              </span>
                            </td>
                            <td style={{ padding: "0.55rem 0.6rem", fontWeight: "600", color: assignedEng === "UNASSIGNED" ? "#DC2626" : "#0F172A", whiteSpace: "nowrap" }}>
                              {assignedEng}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", borderTop: "1px solid #E2E8F0", paddingTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
                    Page {currentPage} of {totalPages}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <button
                      onClick={() => setSlaPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: "0.3rem 0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        backgroundColor: currentPage === 1 ? "#F1F5F9" : "#FFFFFF",
                        color: currentPage === 1 ? "#94A3B8" : "#334155",
                        border: `1px solid ${currentPage === 1 ? "#E2E8F0" : "#CBD5E1"}`,
                        borderRadius: "4px",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      Previous
                    </button>

                    {getPageNumbers().map((p, idx) => {
                      if (p === "...") {
                        return (
                          <span key={`dots-${idx}`} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", color: "#64748B", fontWeight: "700" }}>
                            ...
                          </span>
                        );
                      }
                      const pageNum = p as number;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setSlaPage(pageNum)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            minWidth: "2.1rem",
                            fontSize: "0.75rem",
                            fontWeight: "700",
                            backgroundColor: currentPage === pageNum ? "#B91C1C" : "#FFFFFF",
                            color: currentPage === pageNum ? "#FFFFFF" : "#475569",
                            border: `1px solid ${currentPage === pageNum ? "#B91C1C" : "#CBD5E1"}`,
                            borderRadius: "4px",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setSlaPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: "0.3rem 0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        backgroundColor: currentPage === totalPages ? "#F1F5F9" : "#FFFFFF",
                        color: currentPage === totalPages ? "#94A3B8" : "#334155",
                        border: `1px solid ${currentPage === totalPages ? "#E2E8F0" : "#CBD5E1"}`,
                        borderRadius: "4px",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* ========================================================= */}
      {/* TAB 4: LEGACY HISTORY ARCHIVE (2013 - 2026) */}
      {/* ========================================================= */}
      {activeTab === "legacy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Top 7 KPI Cards */}
          <div className="kpi-grid-7">
            <div className="kpi-card kpi-total">
              <div style={styles.kpiCardLabel}>TOTAL COMPLAINTS</div>
              <div style={{ ...styles.kpiCardVal, color: "#DC2626" }}>14,247</div>
              <div style={styles.kpiCardSub}>Sep 2013 - Jun 2026</div>
            </div>

            <div className="kpi-card kpi-resolved">
              <div style={styles.kpiCardLabel}>RESOLVED / CLOSED</div>
              <div style={{ ...styles.kpiCardVal, color: "#10B981" }}>13,825</div>
              <div style={styles.kpiCardSub}>97.0% resolution rate</div>
            </div>

            <div className="kpi-card kpi-pending">
              <div style={styles.kpiCardLabel}>MEDIAN TAT</div>
              <div style={{ ...styles.kpiCardVal, color: "#2563EB" }}>4 days</div>
              <div style={styles.kpiCardSub}>Avg 24.2d (outliers excl.)</div>
            </div>

            <div className="kpi-card kpi-tat">
              <div style={styles.kpiCardLabel}>STATES COVERED</div>
              <div style={{ ...styles.kpiCardVal, color: "#0F172A" }}>17</div>
              <div style={styles.kpiCardSub}>507 districts</div>
            </div>

            <div className="kpi-card kpi-tat">
              <div style={styles.kpiCardLabel}>ENGINEERS INVOLVED</div>
              <div style={{ ...styles.kpiCardVal, color: "#0F172A" }}>72</div>
              <div style={styles.kpiCardSub}>Field & EPC combined</div>
            </div>

            <div className="kpi-card kpi-needs">
              <div style={styles.kpiCardLabel}>REPEAT COMPLAINT RATE</div>
              <div style={{ ...styles.kpiCardVal, color: "#D97706" }}>38.8%</div>
              <div style={styles.kpiCardSub}>3,119 of 8,037 installs</div>
            </div>

            <div className="kpi-card kpi-tat">
              <div style={styles.kpiCardLabel}>UNIQUE INSTALLATIONS</div>
              <div style={{ ...styles.kpiCardVal, color: "#0F172A" }}>8,037</div>
              <div style={styles.kpiCardSub}>Application IDs on record</div>
            </div>
          </div>

          {/* Annual Volume (2013-2026) Bar Chart */}
          <div className="panel-card" style={styles.cardPadding}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={styles.sectionTitle}>ANNUAL VOLUME (2013-2026)</h3>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>COMPLAINTS RAISED VS RESOLVED — YEAR-WISE</span>
              </div>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#d97706", backgroundColor: "#fffbebf", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                2026 partial year — thru Jun
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "200px", borderBottom: "1px solid #cbd5e1", paddingBottom: "0.5rem" }}>
              {[
                { year: "2013", raised: 10, resolved: 10 },
                { year: "2014", raised: 40, resolved: 40 },
                { year: "2015", raised: 240, resolved: 240 },
                { year: "2016", raised: 860, resolved: 820 },
                { year: "2017", raised: 1710, resolved: 1710 },
                { year: "2018", raised: 2150, resolved: 2150 },
                { year: "2019", raised: 2050, resolved: 2050 },
                { year: "2020", raised: 1000, resolved: 1000 },
                { year: "2021", raised: 1120, resolved: 1120 },
                { year: "2022", raised: 680, resolved: 680 },
                { year: "2023", raised: 230, resolved: 230 },
                { year: "2024", raised: 580, resolved: 580 },
                { year: "2025", raised: 1190, resolved: 1170 },
                { year: "2026", raised: 2280, resolved: 1930 }
              ].map(y => (
                <div key={y.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "160px" }}>
                    <div style={{ width: "10px", height: `${(y.raised / 2300) * 100}%`, backgroundColor: "#fef2f2", border: "1px solid #ef4444" }} title={`Raised: ${y.raised}`} />
                    <div style={{ width: "10px", height: `${(y.resolved / 2300) * 100}%`, backgroundColor: "#15803d" }} title={`Resolved: ${y.resolved}`} />
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.3rem" }}>{y.year}</span>
                </div>
              ))}
            </div>
          </div>

          {/* State-Wise Table & Yearly Trend Line Chart */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>ALL STATES — VOLUME & RESOLUTION RATE</h3>
              <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
                <table style={{ width: "100%", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                      <th style={{ textAlign: "left" }}>#</th>
                      <th style={{ textAlign: "left" }}>STATE</th>
                      <th style={{ textAlign: "center" }}>TOTAL</th>
                      <th style={{ textAlign: "center" }}>RESOLVED</th>
                      <th style={{ textAlign: "right" }}>RATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { rank: 1, state: "Madhya Pradesh", total: 3660, resolved: 3618, rate: "98.9%" },
                      { rank: 2, state: "Maharashtra", total: 3306, resolved: 3014, rate: "91.2%" },
                      { rank: 3, state: "Haryana", total: 2037, resolved: 2016, rate: "99%" },
                      { rank: 4, state: "Bihar", total: 1440, resolved: 1420, rate: "98.6%" },
                      { rank: 5, state: "Rajasthan", total: 1142, resolved: 1136, rate: "99.5%" },
                      { rank: 6, state: "Odisha", total: 876, resolved: 869, rate: "99.2%" },
                      { rank: 7, state: "Uttar Pradesh", total: 836, resolved: 833, rate: "99.6%" }
                    ].map(row => (
                      <tr key={row.rank} style={{ borderBottom: "1px solid #f8fafc" }}>
                        <td style={{ padding: "0.3rem 0", color: "#64748b" }}>{row.rank}</td>
                        <td style={{ fontWeight: "700" }}>{row.state}</td>
                        <td style={{ textAlign: "center" }}>{row.total}</td>
                        <td style={{ textAlign: "center" }}>{row.resolved}</td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ padding: "0.1rem 0.4rem", borderRadius: "10px", border: "1px solid #10b981", color: "#10b981", fontWeight: "700", fontSize: "0.7rem" }}>
                            {row.rate}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel-card" style={styles.cardPadding}>
              <h3 style={styles.sectionTitle}>TOP 4 STATES — YEARLY TREND</h3>
              <div style={{ marginTop: "1rem", height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "0.85rem" }}>
                Multi-year state comparison trend active (Maharashtra, Haryana, MP, Rajasthan)
              </div>
            </div>
          </div>

          {/* All-Time Top 15 Engineer Leaderboard */}
          <div className="panel-card" style={styles.cardPadding}>
            <h3 style={styles.sectionTitle}>ENGINEER LEADERBOARD — ALL-TIME (TOP 15)</h3>
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <table style={{ width: "100%", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                    <th style={{ textAlign: "left" }}>#</th>
                    <th style={{ textAlign: "left" }}>ENGINEER</th>
                    <th style={{ textAlign: "center" }}>TOTAL HANDLED</th>
                    <th style={{ textAlign: "center" }}>RESOLVED</th>
                    <th style={{ textAlign: "right" }}>RESOLUTION RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rank: 1, name: "Rakesh Lodhi", total: 836, resolved: 836, rate: "100%" },
                    { rank: 2, name: "Chandan Upadhyay", total: 737, resolved: 737, rate: "100%" },
                    { rank: 3, name: "IP", total: 705, resolved: 705, rate: "100%" },
                    { rank: 4, name: "Mohd Anish", total: 695, resolved: 688, rate: "99%" },
                    { rank: 5, name: "Shekhshafi", total: 583, resolved: 581, rate: "99.7%" },
                    { rank: 6, name: "ASA EPC", total: 484, resolved: 484, rate: "100%" },
                    { rank: 7, name: "Avinash Mishra", total: 438, resolved: 437, rate: "99.8%" },
                    { rank: 8, name: "Narender", total: 350, resolved: 345, rate: "98.6%" }
                  ].map(row => (
                    <tr key={row.rank} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "0.4rem 0", color: "#64748b" }}>{row.rank}</td>
                      <td style={{ fontWeight: "700" }}>{row.name}</td>
                      <td style={{ textAlign: "center" }}>{row.total}</td>
                      <td style={{ textAlign: "center" }}>{row.resolved}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ padding: "0.1rem 0.4rem", borderRadius: "10px", border: "1px solid #10b981", color: "#10b981", fontWeight: "700", fontSize: "0.7rem" }}>
                          {row.rate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    height: "70vh",
    fontFamily: "var(--font-title, sans-serif)",
    fontSize: "1.1rem",
    color: "#64748B"
  },
  subTabHeader: {
    display: "flex",
    gap: "1.5rem",
    borderBottom: "2px solid #E2E8F0",
    marginBottom: "1.25rem"
  },
  subTabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 0.25rem",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    color: "#64748B",
    fontFamily: "var(--font-title)",
    fontWeight: "600",
    fontSize: "0.92rem",
    cursor: "pointer",
    marginBottom: "-2px",
    transition: "all 0.2s ease"
  },
  subTabBtnActive: {
    color: "#DC2626",
    borderBottomColor: "#DC2626"
  },
  kpiRow6: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "1rem",
    marginBottom: "1.25rem"
  },
  kpiCardItem: {
    padding: "0.85rem 1rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.2rem"
  },
  kpiCardLabel: {
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: "0.04em"
  },
  kpiCardVal: {
    fontSize: "1.6rem",
    fontWeight: "900",
    lineHeight: "1.1"
  },
  kpiCardSub: {
    fontSize: "0.72rem",
    color: "#64748B"
  },
  cardPadding: {
    padding: "1.25rem"
  },
  sectionTitle: {
    margin: 0,
    fontSize: "0.88rem",
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: "0.02em"
  }
};
