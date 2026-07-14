import { prisma } from "../db.js";

async function count() {
  console.log("📊 DATABASE TABLES DIAGNOSTIC COUNT 📊");
  const complaints = await prisma.complaint.count();
  const tickets = await prisma.ticket.count();
  const assignments = await prisma.ticketAssignment.count();
  const history = await prisma.ticketHistory.count();
  const installations = await prisma.masterInstallation.count();
  const engineers = await prisma.engineer.count();
  const users = await prisma.user.count();

  console.log("- Complaints count:", complaints);
  console.log("- Tickets count:", tickets);
  console.log("- Assignments count:", assignments);
  console.log("- History count:", history);
  console.log("- Installations count:", installations);
  console.log("- Engineers count:", engineers);
  console.log("- Users count:", users);

  if (tickets > 0) {
    const first = await prisma.ticket.findFirst();
    console.log("Sample ticket:", JSON.stringify(first));
  }
}

count().catch(console.error).finally(() => prisma.$disconnect());
