import { prisma } from "../db.js";

async function run() {
  console.log("Searching for recently created tickets...");
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      complaint: true
    }
  });
  console.log("Recent Tickets found:");
  tickets.forEach(t => {
    console.log(`- ${t.ticketNumber} | Status: ${t.status} | Client: ${t.complaint?.complainantName} | Application: ${t.complaint?.applicationId} | Created: ${t.createdAt}`);
  });
  await prisma.$disconnect();
}

run();
