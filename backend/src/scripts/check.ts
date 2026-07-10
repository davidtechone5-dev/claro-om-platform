import { prisma } from "../db.js";

async function main() {
  const installationsCount = await prisma.masterInstallation.count();
  const engineersCount = await prisma.engineer.count();
  const usersCount = await prisma.user.count();
  
  console.log("====================================");
  console.log("📊 CURRENT DATABASE RECORD COUNTS");
  console.log("====================================");
  console.log(`📍 Master Installations: ${installationsCount}`);
  console.log(`📍 Engineers:           ${engineersCount}`);
  console.log(`📍 Users (Total):       ${usersCount}`);
  console.log("====================================");

  if (installationsCount > 0) {
    console.log("\nSample Master Installation:");
    const sampleMi = await prisma.masterInstallation.findFirst({
      select: { applicationId: true, clientName: true }
    });
    console.log(sampleMi);
  }

  if (engineersCount > 0) {
    console.log("\nSample Engineer:");
    const sampleEng = await prisma.engineer.findFirst({
      select: { name: true, email: true }
    });
    console.log(sampleEng);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
