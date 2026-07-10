import { NavLink } from "react-router-dom";
import { LayoutDashboard, Ticket, Warehouse, Wrench } from "lucide-react";

export function Sidebar() {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoContainer}>
        <h2 style={styles.logoText}>CLARO <span style={styles.logoSubText}>O&M V2</span></h2>
      </div>
      
      <nav style={styles.nav}>
        <NavLink 
          to="/" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/tickets" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Ticket size={20} />
          <span>Tickets Registry</span>
        </NavLink>

        <NavLink 
          to="/warehouse" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Warehouse size={20} />
          <span>Warehouse Logs</span>
        </NavLink>

        <NavLink 
          to="/amc" 
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <Wrench size={20} />
          <span style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
            <span>AMC Tracker</span>
            <span style={styles.pilotBadge}>MH PILOT</span>
          </span>
        </NavLink>
      </nav>

      <div style={styles.userFooter}>
        <div style={styles.avatar}>A</div>
        <div>
          <div style={styles.userName}>System Admin</div>
          <div style={styles.userRole}>Administrator</div>
        </div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    backgroundColor: "var(--bg-secondary)",
    borderRight: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    padding: "2rem 1.5rem"
  },
  logoContainer: {
    marginBottom: "3rem"
  },
  logoText: {
    fontFamily: "var(--font-title)",
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "0.05em"
  },
  logoSubText: {
    color: "var(--primary)",
    fontSize: "0.9rem",
    fontWeight: "500"
  },
  nav: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
    flexGrow: 1
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.85rem 1rem",
    borderRadius: "10px",
    color: "var(--text-muted)",
    textDecoration: "none",
    fontFamily: "var(--font-title)",
    fontWeight: "500",
    fontSize: "0.95rem",
    transition: "var(--transition-smooth)"
  },
  navLinkActive: {
    backgroundColor: "var(--bg-card)",
    color: "var(--primary)",
    boxShadow: "inset 4px 0 0 var(--primary)",
    border: "1px solid var(--border-color)"
  },
  userFooter: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "1.5rem",
    marginTop: "auto"
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontFamily: "var(--font-title)"
  },
  userName: {
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#fff"
  },
  userRole: {
    fontSize: "0.75rem",
    color: "var(--text-muted)"
  },
  pilotBadge: {
    backgroundColor: "#ea580c",
    color: "#fff",
    fontSize: "0.6rem",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase" as const
  }
};
