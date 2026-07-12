import { prisma } from "../db.js";
import bcrypt from "bcryptjs";

async function run() {
  console.log("🔗 Linking existing engineers to User accounts...");
  
  const salt = 10;
  const passwordHash = bcrypt.hashSync("engineer123", salt);

  // 1. Get Engineer Role
  const engineerRole = await prisma.role.findFirst({
    where: { name: "Engineer" }
  });

  if (!engineerRole) {
    console.error("❌ Engineer role not found in database.");
    process.exit(1);
  }

  // 2. Get all engineers where userId is null
  const engineers = await prisma.engineer.findMany({
    where: { userId: null }
  });

  console.log(`Found ${engineers.length} engineers without user accounts.`);

  let createdCount = 0;
  let linkedCount = 0;

  for (const eng of engineers) {
    if (!eng.email) continue;
    
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: eng.email }
    });

    if (!user) {
      // Create user account
      user = await prisma.user.create({
        data: {
          email: eng.email,
          fullName: eng.name,
          passwordHash: passwordHash,
          roleId: engineerRole.id,
          isActive: true
        }
      });
      createdCount++;
    }

    // Link user to engineer profile
    await prisma.engineer.update({
      where: { id: eng.id },
      data: { userId: user.id }
    });
    linkedCount++;
  }

  console.log(`✅ Process complete: created ${createdCount} user accounts and linked ${linkedCount} profiles.`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
