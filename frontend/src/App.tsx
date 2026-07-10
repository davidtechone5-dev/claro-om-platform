import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Tickets } from "./pages/Tickets";
import { TicketDetails } from "./pages/TicketDetails";
import { Warehouse } from "./pages/Warehouse";
import { AMCTracker } from "./pages/AMCTracker";

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetails />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/amc" element={<AMCTracker />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
