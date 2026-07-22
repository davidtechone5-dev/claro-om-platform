import { NavLink } from "react-router-dom";
import { LayoutDashboard, Ticket, Warehouse, Wrench, Users, LogOut } from "lucide-react";

interface SidebarProps {
  user: {
    fullName: string;
    role: string;
    email: string;
  };
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const isEngineer = user.role === "Engineer";

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <aside className={isOpen ? "open" : ""} style={styles.sidebar}>
      {/* Official Claro Energy Logo Header */}
      <div style={styles.logoContainer}>
        <div className="claro-logo-badge">
          <div className="claro-logo-top">
            <span className="claro-logo-top-text">CLARO<sup>®</sup></span>
          </div>
          <div className="claro-logo-bottom">
            <span className="claro-logo-bottom-text">ENERGY</span>
          </div>
        </div>
      </div>
      
      <nav style={styles.nav}>
        <NavLink 
          to="/" 
          onClick={handleLinkClick}
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {})
          })}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        {!isEngineer && (
          <>
            <NavLink 
              to="/tickets" 
              onClick={handleLinkClick}
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
              onClick={handleLinkClick}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {})
              })}
            >
              <Warehouse size={20} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <span>Warehouse Logs</span>
                <span style={{ 
                  fontSize: "0.62rem", 
                  backgroundColor: "#fee2e2", 
                  color: "#b91c1c", 
                  padding: "0.1rem 0.35rem", 
                  borderRadius: "3px", 
                  fontWeight: "800", 
                  textTransform: "uppercase",
                  letterSpacing: "0.02em"
                }}>Beta</span>
              </div>
            </NavLink>

            <NavLink 
              to="/amc" 
              onClick={handleLinkClick}
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

            <NavLink 
              to="/engineers/overview" 
              onClick={handleLinkClick}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {})
              })}
            >
              <Users size={20} />
              <span>Engineer Reports</span>
            </NavLink>
          </>
        )}
      </nav>

      <div style={styles.userFooter}>
        <div style={styles.userProfile}>
          <div style={styles.avatar}>
            {user.fullName ? user.fullName[0].toUpperCase() : "U"}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user.fullName}</div>
            <div style={styles.userRole}>{user.role}</div>
          </div>
        </div>
        
        <button onClick={onLogout} style={styles.logoutBtn}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
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
    padding: "1.75rem 1.25rem",
    boxSizing: "border-box" as const
  },
  logoContainer: {
    marginBottom: "2rem",
    display: "flex",
    justifyContent: "center"
  },
  nav: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    flexGrow: 1
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    color: "var(--text-muted)",
    textDecoration: "none",
    fontFamily: "var(--font-title)",
    fontWeight: "600",
    fontSize: "0.92rem",
    transition: "var(--transition-smooth)"
  },
  navLinkActive: {
    backgroundColor: "rgba(229, 35, 32, 0.08)",
    color: "var(--primary)",
    boxShadow: "inset 4px 0 0 var(--primary)",
    border: "1px solid rgba(229, 35, 32, 0.2)"
  },
  userFooter: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "1.25rem",
    marginTop: "auto"
  },
  userProfile: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem"
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
    fontWeight: "700",
    fontFamily: "var(--font-title)"
  },
  userInfo: {
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden"
  },
  userName: {
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "var(--text-main)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const
  },
  userRole: {
    fontSize: "0.72rem",
    color: "var(--text-muted)"
  },
  pilotBadge: {
    backgroundColor: "var(--primary)",
    color: "#fff",
    fontSize: "0.55rem",
    fontWeight: "700",
    padding: "1px 5px",
    borderRadius: "4px",
    textTransform: "uppercase" as const
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.6rem",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    backgroundColor: "#FFFFFF",
    color: "var(--color-manual)",
    fontFamily: "var(--font-title)",
    fontWeight: "600",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "var(--transition-smooth)"
  }
};
