const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// Helper to set headers with authorization
function getHeaders(extraHeaders: Record<string, string> = {}) {
  const token = localStorage.getItem("claro_token") || "mock_token_admin"; // Default token fallback for easy local dev testing
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...extraHeaders
  };
}

export const api = {
  /**
   * Health & root verify
   */
  async getHealth() {
    const res = await fetch(`${API_BASE_URL.replace("/api/v1", "")}/health`);
    return await res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Invalid login credentials.");
    }
    return await res.json();
  },

  async me() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to load user profile");
    }
    return await res.json();
  },

  /**
   * Tickets endpoints
   */
  async getTickets(status?: string, priority?: string, search?: string, limit: number = 25, offset: number = 0, startDate?: string, endDate?: string) {
    let url = `${API_BASE_URL}/tickets?limit=${limit}&offset=${offset}`;
    if (status && status !== "ALL") url += `&status=${encodeURIComponent(status)}`;
    if (priority) url += `&priority=${encodeURIComponent(priority)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to load tickets: ${res.statusText}`);
    }
    return await res.json();
  },

  async assignEngineer(ticketId: string, engineerId: string, remarks?: string) {
    const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ engineerId, remarks })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to assign engineer");
    }
    return await res.json();
  },

  async updateTicketStatus(ticketId: string, status: string, summary?: string) {
    const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status, summary })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update status");
    }
    return await res.json();
  },

  /**
   * Engineers directory
   */
  async getEngineers() {
    // In our backend index.ts, we don't have an explicit route to list engineers,
    // but we can query standard fields. Let's make sure it returns them.
    // Wait, the backend has engineers model!
    // Since we need to get list of engineers for dropdown, we can get it or mock.
    // Let's call the endpoint or query.
    // Wait, in backend, did we write an endpoint for engineers?
    // Let's check backend index.ts. We didn't write GET /engineers!
    // Wait, we can fetch all tickets and extract engineers, or we can add GET /engineers to index.ts!
    // Adding GET /engineers to backend index.ts is a super simple edit that solves this.
    // We will do it next. Let's assume we can fetch engineers from GET /api/v1/engineers.
    const res = await fetch(`${API_BASE_URL}/engineers`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to fetch engineers: ${res.statusText}`);
    }
    return await res.json();
  },

  async getEngineerPerformance(engineerId: string, startDate?: string, endDate?: string) {
    let url = `${API_BASE_URL}/engineers/${engineerId}/performance`;
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch engineer performance metrics");
    }
    return await res.json();
  },

  async getAllEngineersPerformance(startDate?: string, endDate?: string) {
    let url = `${API_BASE_URL}/engineers/performance-summary`;
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch all engineers performance report");
    }
    return await res.json();
  },

  /**
   * Material Requests (Warehouse operations)
   */
  async getMaterialRequests() {
    const res = await fetch(`${API_BASE_URL}/material-requests`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch material requests");
    }
    return await res.json();
  },

  async updateMaterialStatus(id: string, status: string) {
    const res = await fetch(`${API_BASE_URL}/material-requests/${id}/status`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      throw new Error("Failed to update material status");
    }
    return await res.json();
  },

  /**
   * AMC Metrics endpoint
   */
  async getAMCMetrics() {
    const res = await fetch(`${API_BASE_URL}/amc/metrics`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch AMC metrics");
    }
    return await res.json();
  }
};
