import { prisma } from "../db.js";
import bcrypt from "bcryptjs";

async function run() {
  console.log("🔄 Resetting database user credentials...");
  
  const salt = 10;
  const adminPassword = bcrypt.hashSync("admin123", salt);
  const engineerPassword = bcrypt.hashSync("engineer123", salt);

  // 1. Reset Admin
  const adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
  if (adminRole) {
    await prisma.user.upsert({
      where: { email: "admin@claro.com" },
      update: { passwordHash: adminPassword, isActive: true },
      create: {
        email: "admin@claro.com",
        fullName: "System Admin",
        passwordHash: adminPassword,
        roleId: adminRole.id,
        isActive: true
      }
    });
    console.log("✅ Admin credentials set to admin@claro.com / admin123");
  }

  // 2. Get all users with Role "Engineer"
  const engineerRole = await prisma.role.findFirst({
    where: { name: "Engineer" }
  });

  if (engineerRole) {
    const updated = await prisma.user.updateMany({
      where: { roleId: engineerRole.id },
      data: { passwordHash: engineerPassword, isActive: true }
    });
    console.log(`✅ Reset password for ${updated.count} engineer accounts to engineer123`);
  } else {
    console.log("❌ Engineer role not found.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
