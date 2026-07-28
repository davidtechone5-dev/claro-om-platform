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

// Interceptor wrapper to automatically handle 401 Unauthorized token expirations
async function fetchWithAuth(url: string, init?: RequestInit) {
  const headers = getHeaders(init?.headers as any);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("claro_token");
    localStorage.removeItem("claro_user");
    window.location.reload();
  }
  return res;
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
    const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`);
    if (!res.ok) {
      throw new Error("Failed to load user profile");
    }
    return await res.json();
  },

  /**
   * Tickets endpoints
   */
  async getTickets(
    statusOrOpts?: string | any,
    priority?: string,
    search?: string,
    limit: number = 25,
    offset: number = 0,
    startDate?: string,
    endDate?: string,
    engineerId?: string
  ) {
    let opts: any = {};
    if (typeof statusOrOpts === "object" && statusOrOpts !== null) {
      opts = statusOrOpts;
    } else {
      opts = { status: statusOrOpts, priority, search, limit, offset, startDate, endDate, engineerId };
    }

    const st = opts.status;
    const pr = opts.priority;
    const sr = opts.search;
    const lm = opts.limit ?? 25;
    const off = opts.offset ?? 0;
    const sDate = opts.startDate;
    const eDate = opts.endDate;
    const engId = opts.engineerId;

    let url = `${API_BASE_URL}/tickets?limit=${lm}&offset=${off}`;
    if (st && st !== "ALL") url += `&status=${encodeURIComponent(st)}`;
    if (pr) url += `&priority=${encodeURIComponent(pr)}`;
    if (sr) url += `&search=${encodeURIComponent(sr)}`;
    if (sDate) url += `&startDate=${encodeURIComponent(sDate)}`;
    if (eDate) url += `&endDate=${encodeURIComponent(eDate)}`;
    if (engId && engId !== "ALL") url += `&engineerId=${encodeURIComponent(engId)}`;

    const res = await fetchWithAuth(url);
    if (!res.ok) {
      throw new Error(`Failed to load tickets: ${res.statusText}`);
    }
    return await res.json();
  },

  async getTicketById(id: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/tickets/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to load ticket details: ${res.statusText}`);
    }
    return await res.json();
  },

  async assignEngineer(ticketId: string, engineerId: string, remarks?: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/tickets/${ticketId}/assign`, {
      method: "POST",
      body: JSON.stringify({ engineerId, remarks })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to assign engineer");
    }
    return await res.json();
  },

  async updateTicketStatus(ticketId: string, status: string, summary?: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/tickets/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, summary })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update status");
    }
    return await res.json();
  },

  async getEngineers() {
    const res = await fetchWithAuth(`${API_BASE_URL}/engineers`);
    if (!res.ok) {
      throw new Error("Failed to fetch engineers");
    }
    return await res.json();
  },

  async addEngineer(data: any) {
    const res = await fetchWithAuth(`${API_BASE_URL}/engineers`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create engineer");
    }
    return await res.json();
  },

  async updateEngineerStatus(id: string, isActive: boolean) {
    const res = await fetchWithAuth(`${API_BASE_URL}/engineers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive })
    });
    if (!res.ok) {
      throw new Error("Failed to update status");
    }
    return await res.json();
  },

  async getEngineerPerformance(engineerId: string, startDate?: string, endDate?: string) {
    let url = `${API_BASE_URL}/engineers/${engineerId}/performance`;
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetchWithAuth(url);
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

    const res = await fetchWithAuth(url);
    if (!res.ok) {
      throw new Error("Failed to fetch all engineers performance report");
    }
    return await res.json();
  },

  /**
   * AMC & Reports
   */
  async getAmcTickets() {
    const res = await fetchWithAuth(`${API_BASE_URL}/amc/tickets`);
    if (!res.ok) {
      throw new Error("Failed to fetch AMC tickets");
    }
    return await res.json();
  },

  async getAmcMetrics() {
    const res = await fetchWithAuth(`${API_BASE_URL}/amc/metrics`);
    if (!res.ok) {
      throw new Error("Failed to fetch AMC metrics");
    }
    return await res.json();
  },

  // Alias for compatibility with casing mismatch in components
  async getAMCMetrics() {
    return this.getAmcMetrics();
  },

  /**
   * WMS endpoints
   */
  async getWmsParts() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/parts`);
    if (!res.ok) throw new Error("Failed to fetch parts");
    return await res.json();
  },

  async getWmsWarehouses() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/warehouses`);
    if (!res.ok) throw new Error("Failed to fetch warehouses");
    return await res.json();
  },

  async getWmsManufacturers() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/manufacturers`);
    if (!res.ok) throw new Error("Failed to fetch manufacturers");
    return await res.json();
  },

  async getWmsFarmers() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/farmers`);
    if (!res.ok) throw new Error("Failed to fetch farmers");
    return await res.json();
  },

  async getWmsEngineers() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/engineers`);
    if (!res.ok) throw new Error("Failed to fetch engineers");
    return await res.json();
  },

  async getWmsPendingRMAs(warehouseId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/pending-rmas?warehouseId=${encodeURIComponent(warehouseId)}`);
    if (!res.ok) throw new Error("Failed to fetch pending RMAs");
    return await res.json();
  },

  async getWmsChallans() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/challans`);
    if (!res.ok) throw new Error("Failed to fetch challans");
    return await res.json();
  },

  async getWmsStock(warehouseId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/stock?warehouseId=${encodeURIComponent(warehouseId)}`);
    if (!res.ok) throw new Error("Failed to fetch WMS live stock");
    return await res.json();
  },

  async getWmsMovements(warehouseId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/movements?warehouseId=${encodeURIComponent(warehouseId)}`);
    if (!res.ok) throw new Error("Failed to fetch WMS movements ledger");
    return await res.json();
  },

  async logWmsMovement(data: any) {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/movements`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to log movement");
    }
    return await res.json();
  },

  async deleteWmsMovement(id: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/movements/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete movement");
    return await res.json();
  },

  async getMaterialRequests() {
    const res = await fetchWithAuth(`${API_BASE_URL}/material-requests`);
    if (!res.ok) throw new Error("Failed to fetch material requests");
    return await res.json();
  },

  async updateMaterialStatus(id: string, status: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/material-requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error("Failed to update status");
    return await res.json();
  },

  async clearWmsAll() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/clear-all`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to clear WMS data");
    return await res.json();
  },

  async syncWmsRequests() {
    const res = await fetchWithAuth(`${API_BASE_URL}/wms/sync-requests`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to sync sheets material requests");
    return await res.json();
  }
};
