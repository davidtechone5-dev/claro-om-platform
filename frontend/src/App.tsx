import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Tickets } from "./pages/Tickets";
import { TicketDetails } from "./pages/TicketDetails";
import { Warehouse } from "./pages/Warehouse";
import { AMCTracker } from "./pages/AMCTracker";
import { Login } from "./pages/Login";
import { EngineerReport } from "./pages/EngineerReport";
import { EngineersOverview } from "./pages/EngineersOverview";
import { StateReport } from "./pages/StateReport";
import { Menu } from "lucide-react";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("claro_token"));
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem("claro_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync token and user in localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("claro_token", token);
    } else {
      localStorage.removeItem("claro_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("claro_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("claro_user");
    }
  }, [user]);

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSidebarOpen(false);
    localStorage.removeItem("claro_token");
    localStorage.removeItem("claro_user");
  };

  // 12-Minute Inactivity Idle Timeout
  useEffect(() => {
    if (!token) return;

    let timeoutId: any;
    const TIMEOUT_DURATION = 12 * 60 * 1000; // 12 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        alert("You have been logged out automatically due to 12 minutes of inactivity.");
      }, TIMEOUT_DURATION);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [token]);

  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isEngineer = user.role === "Engineer";

  return (
    <Router>
      <div className="app-container">
        {/* Mobile Header Bar */}
        <div className="mobile-header-bar">
          <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div style={{ fontFamily: "var(--font-title)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>
            CLARO <span style={{ color: "var(--primary)" }}>O&M V2</span>
          </div>
          <div style={{ width: 40 }}></div>
        </div>

        {/* Mobile Sidebar overlay */}
        <div 
          className={`mobile-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <Sidebar 
          user={user} 
          onLogout={handleLogout} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            
            {/* Guard routes for Engineers */}
            <Route 
              path="/tickets" 
              element={isEngineer ? <Navigate to="/" replace /> : <Tickets />} 
            />
            <Route path="/tickets/:id" element={<TicketDetails />} />
            <Route path="/engineers/overview" element={<EngineersOverview />} />
            <Route path="/engineers/:id/report" element={<EngineerReport />} />
            <Route path="/states/:stateName/report" element={<StateReport />} />
            <Route 
              path="/warehouse" 
              element={isEngineer ? <Navigate to="/" replace /> : <Warehouse />} 
            />
            <Route 
              path="/amc" 
              element={isEngineer ? <Navigate to="/" replace /> : <AMCTracker />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
