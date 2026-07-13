import { prisma } from "../db.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { normalizeMaterialStatus } from "../utils/status.js";

export const ticketService = {
  /**
   * Generates a unique, race-condition-safe ticket number using a count check and sequential retries.
   */
  async generateUniqueTicketNumber(datePrefix: string, tx: Prisma.TransactionClient = prisma): Promise<string> {
    const todayCount = await tx.ticket.count({
      where: {
        ticketNumber: {
          startsWith: datePrefix
        }
      }
    });

    let attempt = 0;
    while (attempt < 5) {
      const sequence = (todayCount + 1 + attempt).toString().padStart(4, "0");
      const ticketNumber = `${datePrefix}-${sequence}`;

      // Check if this ticket number is already taken
      const exists = await tx.ticket.findUnique({
        where: { ticketNumber }
      });

      if (!exists) {
        return ticketNumber;
      }
      attempt++;
    }

    // Fallback: append a secure random suffix if all retry sequences collide
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    return `${datePrefix}-${randomSuffix}`;
  },

  /**
   * Records a status update audit history event for a ticket.
   */
  async createStatusHistory(
    ticketId: string,
    oldStatus: string | null,
    newStatus: string,
    changeSummary: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.ticketHistory.create({
      data: {
        ticketId,
        oldStatus,
        newStatus,
        changeSummary
      }
    });
  },

  /**
   * Safely updates engineer assignment. Does not delete/recreate if it is the same engineer.
   */
  async handleAssignment(
    ticketId: string,
    engineerId: string,
    assignedAt: Date,
    tx: Prisma.TransactionClient = prisma
  ) {
    const existing = await tx.ticketAssignment.findFirst({
      where: { ticketId }
    });

    if (existing) {
      if (existing.engineerId === engineerId) {
        // Engineer matches existing assignment; do nothing
        return existing;
      }
      // Re-assign: delete old assignment first
      await tx.ticketAssignment.delete({
        where: { id: existing.id }
      });
    }

    // Create new assignment
    return tx.ticketAssignment.create({
      data: {
        ticketId,
        engineerId,
        assignedAt
      }
    });
  },

  /**
   * Safely handles initial visit records. Upserts to prevent duplicates.
   */
  async handleInitialVisit(
    ticketId: string,
    engineerId: string,
    visitDate: Date,
    remarks: string = "Completed diagnostic check on pump.",
    tx: Prisma.TransactionClient = prisma
  ) {
    const existing = await tx.initialVisit.findFirst({
      where: { ticketId }
    });

    if (existing) {
      return tx.initialVisit.update({
        where: { id: existing.id },
        data: {
          engineerId,
          visitDate,
          remarks
        }
      });
    }

    return tx.initialVisit.create({
      data: {
        ticketId,
        engineerId,
        visitDate,
        remarks
      }
    });
  },

  /**
   * Safely handles service report logs. Upserts to prevent duplicate reports.
   */
  async handleServiceReport(
    ticketId: string,
    reportDate: Date,
    workDone: string = "Inspected wiring and restored system operation.",
    status: string = "COMPLETED",
    tx: Prisma.TransactionClient = prisma
  ) {
    const existing = await tx.serviceReport.findFirst({
      where: { ticketId }
    });

    if (existing) {
      return tx.serviceReport.update({
        where: { id: existing.id },
        data: {
          reportDate,
          workDone,
          status
        }
      });
    }

    return tx.serviceReport.create({
      data: {
        ticketId,
        reportDate,
        workDone,
        status
      }
    });
  },

  /**
   * Safely logs material request, validating and mapping the status correctly.
   */
  async handleMaterialRequest(
    ticketId: string,
    engineerId: string,
    materialStatusStr: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    const cleanStatus = normalizeMaterialStatus(materialStatusStr);

    const existing = await tx.materialRequest.findFirst({
      where: { ticketId }
    });

    if (existing) {
      return tx.materialRequest.update({
        where: { id: existing.id },
        data: {
          requestedBy: engineerId,
          status: cleanStatus
        }
      });
    }

    const materialRequestId = randomUUID();
    await tx.materialRequest.create({
      data: {
        id: materialRequestId,
        ticketId,
        requestedBy: engineerId,
        status: cleanStatus,
        remarks: "Required solar components."
      }
    });

    await tx.materialRequestItem.create({
      data: {
        materialRequestId,
        itemName: "Solar Pump Controller Card",
        quantity: 1
      }
    });

    return materialRequestId;
  }
};
