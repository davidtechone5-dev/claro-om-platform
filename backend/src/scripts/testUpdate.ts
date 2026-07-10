import { prisma } from "../db.js";

async function run() {
  console.log("Updating client name for application MS2703246981 in database...");
  await prisma.masterInstallation.update({
    where: { applicationId: "MS2703246981" },
    data: { clientName: "Mohan Sahebrao Live-Check" }
  });
  console.log("Database updated successfully!");
  await prisma.$disconnect();
}

run();
