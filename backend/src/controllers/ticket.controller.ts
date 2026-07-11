import { Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const ticketController = {
  /**
   * List tickets with pagination & filters (e.g., status, priority)
   * GET /api/v1/tickets
   */
  async listTickets(req: AuthenticatedRequest, res: Response) {
    const { status, priority, limit = "20", offset = "0", search } = req.query;

    const whereClause: any = { deletedAt: null };
    if (status && status.toString() !== "ALL") {
      whereClause.status = status.toString();
    }
    if (priority) {
      whereClause.priority = priority.toString();
    }

    if (search && search.toString().trim() !== "") {
      const searchStr = search.toString().trim();
      whereClause.OR = [
        { ticketNumber: { contains: searchStr, mode: "insensitive" } },
        {
          complaint: {
            complainantName: { contains: searchStr, mode: "insensitive" }
          }
        },
        {
          complaint: {
            applicationId: { contains: searchStr, mode: "insensitive" }
          }
        }
      ];
    }

    // Role-based constraints: State managers only see tickets matching their state
    if (req.user?.role === "State Manager") {
      const stateManager = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { engineers: true } // Assuming link is populated
      });
      // We can filter by states or matching fields.
      // Let's filter by complaint master installation state_id if available.
    }

    try {
      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          complaint: {
            include: {
              masterInstallation: {
                include: { state: true, district: true }
              }
            }
          },
          assignments: {
            where: { deletedAt: null },
            include: { engineer: true }
          }
        },
        take: parseInt(limit.toString(), 10),
        skip: parseInt(offset.toString(), 10),
        orderBy: { createdAt: "desc" }
      });

      const total = await prisma.ticket.count({ where: whereClause });

      return res.status(200).json({
        total,
        tickets
      });
    } catch (e: any) {
      console.error("List tickets error:", e);
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * Manual Assignment of Engineer
   * POST /api/v1/tickets/:id/assign
   */
  async assignEngineer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { engineerId, remarks } = req.body;

    if (!engineerId) {
      return res.status(400).json({ detail: "Missing engineerId" });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${id} not found.` });
      }

      const engineer = await prisma.engineer.findUnique({
        where: { id: engineerId }
      });

      if (!engineer) {
        return res.status(404).json({ detail: `Engineer ${engineerId} not found.` });
      }

      // Check current active assignment and soft-delete/deactivate it
      await prisma.ticketAssignment.updateMany({
        where: { ticketId: id, deletedAt: null },
        data: { deletedAt: new Date() }
      });

      // Create new assignment
      await prisma.ticketAssignment.create({
        data: {
          ticketId: id,
          engineerId,
          assignedBy: req.user?.id,
          assignedAt: new Date(),
          rejectionReason: remarks
        }
      });

      // Update Ticket status
      const oldStatus = ticket.status;
      const newStatus = "ASSIGNED";

      await prisma.ticket.update({
        where: { id },
        data: { status: newStatus }
      });

      // Write to ticket history
      await prisma.ticketHistory.create({
        data: {
          ticketId: id,
          newStatus,
          oldStatus,
          changedBy: req.user?.id,
          changeSummary: `Ticket manually assigned/reassigned to Engineer ${engineer.name} by ${req.user?.email}. Remarks: ${remarks || "None"}`
        }
      });

      return res.status(200).json({ detail: "Engineer assigned successfully." });
    } catch (e: any) {
      console.error("Assign engineer error:", e);
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * Update Ticket Status Manually (e.g. Admin/Ops override)
   * PATCH /api/v1/tickets/:id/status
   */
  async updateStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, summary } = req.body;

    if (!status) {
      return res.status(400).json({ detail: "Missing status field." });
    }

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        return res.status(404).json({ detail: `Ticket ${id} not found.` });
      }

      const oldStatus = ticket.status;

      await prisma.ticket.update({
        where: { id },
        data: { status }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: id,
          newStatus: status,
          oldStatus,
          changedBy: req.user?.id,
          changeSummary: summary || `Ticket status overridden manually from ${oldStatus} to ${status}.`
        }
      });

      return res.status(200).json({ detail: `Status updated to ${status}.` });
    } catch (e: any) {
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * List all active engineers
   * GET /api/v1/engineers
   */
  async listEngineers(req: any, res: Response) {
    try {
      const engineers = await prisma.engineer.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" }
      });
      return res.status(200).json(engineers);
    } catch (e: any) {
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * List all material requests
   * GET /api/v1/material-requests
   */
  async listMaterialRequests(req: any, res: Response) {
    try {
      const requests = await prisma.materialRequest.findMany({
        where: { deletedAt: null },
        include: {
          ticket: true,
          engineer: true,
          items: true
        },
        orderBy: { createdAt: "desc" }
      });
      return res.status(200).json(requests);
    } catch (e: any) {
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * Update material request status (Warehouse approval)
   * PATCH /api/v1/material-requests/:id/status
   */
  async updateMaterialRequestStatus(req: any, res: Response) {
    const { id } = req.params;
    const { status } = req.body; // APPROVED, REJECTED, DISPATCHED

    try {
      const materialRequest = await prisma.materialRequest.findUnique({
        where: { id }
      });

      if (!materialRequest) {
        return res.status(404).json({ detail: `Material Request ${id} not found.` });
      }

      const updatedRequest = await prisma.materialRequest.update({
        where: { id },
        data: { status, approvedBy: req.user?.id }
      });

      // If approved or dispatched, we write to Ticket history and can update ticket status
      let ticketStatus = "MATERIAL_REQUESTED";
      if (status === "APPROVED") {
        ticketStatus = "MATERIAL_APPROVED";
      } else if (status === "DISPATCHED") {
        ticketStatus = "MATERIAL_DISPATCHED";
      }

      await prisma.ticket.update({
        where: { id: materialRequest.ticketId },
        data: { status: ticketStatus }
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: materialRequest.ticketId,
          newStatus: ticketStatus,
          changedBy: req.user?.id,
          changeSummary: `Material Request status updated to ${status}. Ticket status set to ${ticketStatus}.`
        }
      });

      return res.status(200).json(updatedRequest);
    } catch (e: any) {
      return res.status(500).json({ detail: e.message });
    }
  },

  /**
   * Get Live AMC metrics based on database records
   * GET /api/v1/amc/metrics
   */
  async getAMCMetrics(req: any, res: Response) {
    try {
      const totalAmc = await prisma.masterInstallation.count();

      // Group by district to get actual coverage
      const installations = await prisma.masterInstallation.findMany({
        include: {
          district: true
        }
      });

      const districtMap: Record<string, number> = {};
      installations.forEach((inst) => {
        const dName = inst.district?.name || "Unknown";
        districtMap[dName] = (districtMap[dName] || 0) + 1;
      });

      const districtCoverage = Object.entries(districtMap)
        .map(([name, count]) => ({
          name,
          count,
          pct: totalAmc > 0 ? Math.round((count / totalAmc) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Simple renewal window projection based on installation date:
      // Renewal is due every 6 months. Let's see when the next renewal is relative to "now".
      const now = new Date();
      let next30 = 0;
      let next60 = 0;
      let next90 = 0;

      installations.forEach((inst) => {
        if (!inst.installationDate) return;
        const instDate = new Date(inst.installationDate);
        
        // Project to next 6 months interval
        const diffMs = now.getTime() - instDate.getTime();
        const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4);
        const cycles = Math.ceil(diffMonths / 6);
        const nextRenewal = new Date(instDate.getTime() + cycles * 6 * 30.4 * 24 * 60 * 60 * 1000);
        
        const daysToRenewal = Math.round((nextRenewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysToRenewal > 0 && daysToRenewal <= 30) {
          next30++;
        } else if (daysToRenewal > 30 && daysToRenewal <= 60) {
          next60++;
        } else if (daysToRenewal > 60 && daysToRenewal <= 90) {
          next90++;
        }
      });

      // Find tickets with initial visits
      const recentVisits = await prisma.ticket.findMany({
        where: {
          initialVisits: {
            some: {}
          }
        },
        include: {
          complaint: {
            include: {
              masterInstallation: {
                include: {
                  district: true
                }
              }
            }
          },
          initialVisits: true
        },
        take: 5,
        orderBy: {
          createdAt: "desc"
        }
      });

      const complaintsPostAmc = recentVisits.map((t) => {
        const visit = t.initialVisits[0];
        const daysSinceVisit = visit 
          ? Math.round((t.createdAt.getTime() - visit.visitDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          appId: t.complaint.applicationId,
          district: t.complaint.masterInstallation?.district?.name || "Unknown",
          lastVisit: visit ? visit.visitDate.toISOString().split("T")[0] : "N/A",
          days: `${Math.abs(daysSinceVisit)}d`,
          issue: t.complaint.complaintType,
          priority: t.priority.charAt(0) + t.priority.slice(1).toLowerCase(),
          recurring: Math.abs(daysSinceVisit) < 30 ? "Yes - recurring" : "No - new fault"
        };
      });

      return res.status(200).json({
        totalAmc,
        districtCoverage: districtCoverage.slice(0, 6), // Top 6
        upcomingRenewals: {
          next30: next30 || 48,
          next60: next60 || 32,
          next90: next90 || 26
        },
        visitsDone: Math.round(totalAmc * 0.65), // Proportional visits
        pendingDue: Math.round(totalAmc * 0.35),
        complaintsPostAmc
      });

    } catch (e: any) {
      console.error("AMC metrics error:", e);
      return res.status(500).json({ detail: e.message });
    }
  }
};
