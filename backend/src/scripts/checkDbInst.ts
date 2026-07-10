import { prisma } from "../db.js";

async function run() {
  console.log("Searching for installation with applicationId = 'MK0206234765'...");
  const inst = await prisma.masterInstallation.findFirst({
    where: { applicationId: "MK0206234765" }
  });
  console.log("Result for MK0206234765:", inst);

  console.log("Searching for ALL installations matching 'MK0206234765' (including space trims)...");
  const allInst = await prisma.masterInstallation.findMany();
  const matched = allInst.filter(i => i.applicationId.trim() === "MK0206234765");
  console.log(`Found ${matched.length} trimmed matches:`);
  matched.forEach(m => {
    console.log(`- ID: '${m.applicationId}' | Client: ${m.clientName}`);
  });

  await prisma.$disconnect();
}

run();
