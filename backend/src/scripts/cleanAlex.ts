import { prisma } from "../db.js";

async function main() {
  await prisma.ticketAssignment.deleteMany({
    where: { engineer: { OR: [{ name: "Alex Rivera" }, { email: "engineer@claro.com" }] } }
  });
  await prisma.initialVisit.deleteMany({
    where: { engineer: { OR: [{ name: "Alex Rivera" }, { email: "engineer@claro.com" }] } }
  });
  await prisma.materialRequest.deleteMany({
    where: { engineer: { OR: [{ name: "Alex Rivera" }, { email: "engineer@claro.com" }] } }
  });
  await prisma.engineer.deleteMany({
    where: { OR: [{ name: "Alex Rivera" }, { email: "engineer@claro.com" }] }
  });
  await prisma.user.deleteMany({
    where: { OR: [{ fullName: "Alex Rivera" }, { email: "engineer@claro.com" }] }
  });
  console.log("✅ Successfully deleted Alex Rivera test engineer profile and account!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
