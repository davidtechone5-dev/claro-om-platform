import React, { useState } from "react";

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  centerVal?: number | string;
  centerLabel?: string;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  centerVal,
  centerLabel,
  size = 160
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const filteredData = data.filter((d) => d.value > 0);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "4px solid #e2e8f0", color: "#64748b", fontSize: "0.75rem" }}>
        No Data
      </div>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let currentAngle = 0;

  const activeItem = hoveredIdx !== null ? filteredData[hoveredIdx] : null;
  const displayVal = activeItem ? activeItem.value : (centerVal !== undefined ? centerVal : total);
  const displayLabel = activeItem ? activeItem.name : (centerLabel || "TOTAL");

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <svg width={size} height={size} viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
        {filteredData.map((item, idx) => {
          const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
          const strokeDashoffset = -currentAngle;
          currentAngle += (item.value / total) * circumference;

          const isHovered = hoveredIdx === idx;

          return (
            <circle
              key={idx}
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth={isHovered ? "28" : "22"}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-width 0.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s",
                cursor: "pointer",
                filter: isHovered ? "drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.15))" : "none"
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none"
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: "900", color: "#0f172a", lineHeight: "1", transition: "all 0.15s ease" }}>
          {displayVal}
        </div>
        <div style={{ fontSize: "0.58rem", fontWeight: "800", color: activeItem ? activeItem.color : "#64748b", textTransform: "uppercase", marginTop: "4px", transition: "all 0.15s ease", textAlign: "center", maxWidth: "90px" }}>
          {displayLabel}
        </div>
      </div>
    </div>
  );
};

interface DualLineChartProps {
  data: Array<{ date: string; volume?: number; raised?: number; resolved?: number }>;
  height?: number;
}

export const DualLineChart: React.FC<DualLineChartProps> = ({ data, height = 200 }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; date: string } | null>(null);

  if (!data || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.8rem" }}>No Data</div>;
  }

  const values = data.map((d) => d.volume ?? d.raised ?? 0);
  const rawMax = Math.max(...values, 4);
  const maxVal = Math.ceil(rawMax / 2) * 2; // round up to nearest even integer
  const width = 500;
  
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 30;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, data.length - 1)) * chartWidth;
    const val = d.volume ?? d.raised ?? 0;
    const y = paddingTop + (1 - (val / maxVal)) * chartHeight;
    return { x, y, val, date: d.date };
  });

  const getBezierPath = (pts: typeof points) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const pathD = getBezierPath(points);
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "visible" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Horizontal Grid lines & Y Axis labels */}
        {gridSteps.map((step, idx) => {
          const val = Math.round(step * maxVal);
          const y = paddingTop + (1 - step) * chartHeight;
          return (
            <g key={idx}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="#f1f5f9" 
                strokeWidth="1" 
              />
              <text 
                x={paddingLeft - 8} 
                y={y + 3} 
                textAnchor="end" 
                fill="#94a3b8" 
                fontSize="10" 
                fontWeight="600"
              >
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaD} fill="url(#chartAreaGrad)" />
        <path d={pathD} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={paddingTop}
            x2={hoveredPoint.x}
            y2={height - paddingBottom}
            stroke="#e2e8f0"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            style={{ transition: "x1 0.1s, x2 0.1s" }}
          />
        )}

        {/* X Axis Date labels */}
        {points.map((p, i) => {
          if (i % 2 !== 0) return null;
          return (
            <text
              key={`x-${i}`}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
              fontWeight="600"
            >
              {p.date}
            </text>
          );
        })}

        {points.map((p, i) => {
          const isHovered = hoveredPoint && hoveredPoint.date === p.date;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="16"
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? "#dc2626" : "#ffffff"}
                stroke="#dc2626"
                strokeWidth="2"
                style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
              />
            </g>
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 45}%`,
            transform: "translateX(-50%)",
            backgroundColor: "#1e293b",
            color: "#ffffff",
            padding: "0.3rem 0.5rem",
            borderRadius: "4px",
            fontSize: "0.68rem",
            fontWeight: "700",
            pointerEvents: "none",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            whiteSpace: "nowrap",
            zIndex: 10,
            transition: "left 0.1s ease, top 0.1s ease"
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: "0.6rem", fontWeight: "600", marginBottom: "1px" }}>{hoveredPoint.date}</div>
          <div>Volume: <span style={{ color: "#f87171" }}>{hoveredPoint.val}</span></div>
        </div>
      )}
    </div>
  );
};

interface InteractiveBarChartProps {
  data: Array<{ name: string; assigned: number; resolved: number }>;
  height?: number;
}

export const InteractiveBarChart: React.FC<InteractiveBarChartProps> = ({ data, height = 180 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.8rem" }}>No Data</div>;
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.assigned, d.resolved)), 1);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height, borderBottom: "1px solid #cbd5e1", paddingBottom: "0.5rem", gap: "0.4rem" }}>
        {data.map((eng, idx) => {
          const assignedH = Math.min(100, Math.max(10, (eng.assigned / maxVal) * 100));
          const resolvedH = Math.min(100, Math.max(5, (eng.resolved / maxVal) * 100));
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
                cursor: "pointer",
                padding: "0.2rem 0",
                backgroundColor: isHovered ? "#f8fafc" : "transparent",
                borderRadius: "4px",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: `${height - 40}px` }}>
                <div
                  style={{
                    width: "12px",
                    height: `${assignedH}%`,
                    backgroundColor: isHovered ? "#fee2e2" : "#fef2f2",
                    border: "1px solid #ef4444",
                    borderRadius: "2px 2px 0 0",
                    transition: "all 0.15s ease"
                  }}
                />
                <div
                  style={{
                    width: "12px",
                    height: `${resolvedH}%`,
                    backgroundColor: isHovered ? "#991b1b" : "#b91c1c",
                    borderRadius: "2px 2px 0 0",
                    transition: "all 0.15s ease"
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: isHovered ? "700" : "600",
                  color: isHovered ? "#0f172a" : "#64748b",
                  marginTop: "0.4rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                  textAlign: "center"
                }}
              >
                {eng.name}
              </div>
            </div>
          );
        })}
      </div>

      {hoveredIdx !== null && (
        <div
          style={{
            position: "absolute",
            bottom: `${height + 5}px`,
            left: `${(hoveredIdx / data.length) * 100 + (50 / data.length)}%`,
            transform: "translateX(-50%)",
            backgroundColor: "#1e293b",
            color: "#ffffff",
            padding: "0.4rem 0.6rem",
            borderRadius: "6px",
            fontSize: "0.68rem",
            fontWeight: "700",
            pointerEvents: "none",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
            zIndex: 20,
            whiteSpace: "nowrap",
            transition: "left 0.15s ease"
          }}
        >
          <div style={{ color: "#f87171", fontSize: "0.7rem", marginBottom: "2px" }}>{data[hoveredIdx].name}</div>
          <div>Assigned: <span style={{ color: "#fca5a5" }}>{data[hoveredIdx].assigned}</span></div>
          <div>Resolved: <span style={{ color: "#86efac" }}>{data[hoveredIdx].resolved}</span></div>
        </div>
      )}
    </div>
  );
};
