import { useEffect, useState } from "react";
import { api } from "../utils/api";

export function Warehouse() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      try {
        const data = await api.getMaterialRequests();
        setRequests(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading Warehouse Inventory Logs...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <h1 className="page-title" style={{ margin: 0 }}>Warehouse Logs</h1>
        <span style={{ 
          fontSize: "0.75rem", 
          backgroundColor: "#fee2e2", 
          color: "#b91c1c", 
          padding: "0.2rem 0.5rem", 
          borderRadius: "4px", 
          fontWeight: "800", 
          textTransform: "uppercase",
          letterSpacing: "0.03em"
        }}>Beta</span>
      </div>

      <div className="panel-card" style={{ padding: "0" }}>
        <div className="custom-table-container" style={{ margin: "0", border: "none" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Ticket ID</th>
                <th>Requested By</th>
                <th>Items Requested</th>
                <th>Requested Date</th>
                 <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No material requests logged.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: "600", color: "var(--text-main)", fontFamily: "monospace" }}>
                      #{r.id.slice(0, 8)}
                    </td>
                    <td style={{ fontWeight: "500", color: "var(--text-muted)" }}>
                      {r.ticket?.ticketNumber}
                    </td>
                    <td>{r.engineer?.name}</td>
                    <td>
                      <div style={styles.itemsList}>
                        {r.items?.length > 0 ? (
                          r.items.map((item: any) => (
                            <span key={item.id} style={styles.itemBadge}>
                              {item.itemName} x{item.quantity}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            {r.remarks || "No details"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge status-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "80vh",
    fontFamily: "var(--font-title)",
    fontSize: "1.2rem",
    color: "var(--text-muted)"
  },
  itemsList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.35rem"
  },
  itemBadge: {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    padding: "0.15rem 0.5rem",
    borderRadius: "6px",
    fontSize: "0.80rem",
    color: "var(--text-main)",
    fontWeight: "500"
  },
  actionBtns: {
    display: "flex",
    gap: "0.5rem"
  },
  approveBtn: {
    padding: "0.4rem 0.6rem",
    backgroundColor: "var(--color-resolved)",
    boxShadow: "none"
  },
  rejectBtn: {
    padding: "0.4rem 0.6rem",
    borderColor: "var(--color-manual)",
    color: "var(--color-manual)"
  },
  dispatchBtn: {
    padding: "0.4rem 0.8rem",
    fontSize: "0.8rem"
  },
  banner: {
    backgroundColor: "hsla(210, 100%, 50%, 0.15)",
    border: "1px solid var(--primary)",
    color: "#fff",
    padding: "1rem",
    borderRadius: "10px",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
    fontWeight: "500"
  }
};
