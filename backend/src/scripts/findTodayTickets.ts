import { prisma } from "../db.js";

async function run() {
  console.log("Searching for all tickets created or modified today...");
  const tickets = await prisma.ticket.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-07-10T00:00:00.000Z")
      }
    },
    include: {
      complaint: true
    }
  });
  console.log(`Found ${tickets.length} tickets:`);
  tickets.forEach(t => {
    console.log(`- ${t.ticketNumber} | Status: ${t.status} | Client: ${t.complaint?.complainantName} | Date: ${t.createdAt.toISOString()}`);
  });
  await prisma.$disconnect();
}

run();
