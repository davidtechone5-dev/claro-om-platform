import { prisma } from "../db.js";

export const assignmentService = {
  /**
   * Automates engineer assignment for a newly created ticket based on geographic coverage and workload constraints
   */
  async assignEngineerToTicket(ticketId: string, applicationId: string): Promise<string | null> {
    try {
      // 1. Get the installation state & district details
      const installation = await prisma.masterInstallation.findFirst({
        where: { 
          applicationId: applicationId,
          deletedAt: null
        },
        select: { 
          stateId: true, 
          districtId: true 
        }
      });

      if (!installation) {
        console.warn(`No master installation found for Application ID: ${applicationId}`);
        return null;
      }

      if (!installation.stateId || !installation.districtId) {
        console.warn(`Installation for Application ID: ${applicationId} is missing state/district definition.`);
        return null;
      }

      // 2. Find eligible engineers matching state, district, active status and valid joining date (created_at <= now)
      const eligibleEngineers = await prisma.engineer.findMany({
        where: {
          stateId: installation.stateId,
          districtId: installation.districtId,
          isActive: true,
          deletedAt: null,
          createdAt: {
            lte: new Date() // Joining date valid (not in the future)
          }
        }
      });

      if (eligibleEngineers.length === 0) {
        console.log(`No engineers cover the location (State: ${installation.stateId}, District: ${installation.districtId})`);
        return null;
      }

      // 3. For each engineer, check daily load limit (max 5 tickets per day) and count total active tickets
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const engineerMetrics = [];

      for (const eng of eligibleEngineers) {
        // Tickets assigned today
        const todayAssignmentsCount = await prisma.ticketAssignment.count({
          where: {
            engineerId: eng.id,
            assignedAt: {
              gte: today
            },
            deletedAt: null
          }
        });

        // Max daily tickets constraint check (default to 5 limit)
        if (todayAssignmentsCount >= 5) {
          continue; // Exclude engineer since daily load limit reached
        }

        // Current total active tickets (status NOT in RESOLVED, CLOSED, ARCHIVED)
        const activeTicketsCount = await prisma.ticketAssignment.count({
          where: {
            engineerId: eng.id,
            ticket: {
              status: {
                notIn: ["RESOLVED", "CLOSED", "ARCHIVED"]
              },
              deletedAt: null
            },
            deletedAt: null
          }
        });

        engineerMetrics.push({
          engineer: eng,
          activeTicketsCount
        });
      }

      if (engineerMetrics.length === 0) {
        console.log(`All eligible engineers have hit their daily limit of 5 assignments today.`);
        return null;
      }

      // 4. Sort engineers by active ticket count (least tickets first)
      engineerMetrics.sort((a, b) => a.activeTicketsCount - b.activeTicketsCount);

      const selectedEngineer = engineerMetrics[0].engineer;

      // 5. Create Ticket Assignment record
      await prisma.ticketAssignment.create({
        data: {
          ticketId: ticketId,
          engineerId: selectedEngineer.id,
          assignedAt: new Date()
        }
      });

      // Update ticket status to ASSIGNED
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "ASSIGNED" }
      });

      // Write to ticket history
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticketId,
          newStatus: "ASSIGNED",
          oldStatus: "RECEIVED",
          changeSummary: `Ticket automatically assigned to Engineer ${selectedEngineer.name} (Active tickets: ${engineerMetrics[0].activeTicketsCount}).`
        }
      });

      return selectedEngineer.id;
    } catch (error) {
      console.error(`Error executing engineer auto-assignment for Ticket ${ticketId}:`, error);
      return null;
    }
  }
};
