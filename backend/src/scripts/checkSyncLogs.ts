import { prisma } from "../db.js";

async function run() {
  console.log("Querying sync logs...");
  const logs = await prisma.syncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10
  });
  console.log(`Found ${logs.length} sync logs:`);
  logs.forEach(l => {
    console.log(`- Row: ${l.rowNumber} | Sheet: ${l.sheetName} | Status: ${l.status} | Error: ${l.errorMessage} | Date: ${l.createdAt}`);
  });
  await prisma.$disconnect();
}

run();
