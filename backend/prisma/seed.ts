import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Start seeding local database...");

  // 1. Seed Roles
  const roles = ["Admin", "Operations", "State Manager", "Warehouse", "Engineer", "Viewer"];
  const roleMap: Record<string, any> = {};

  for (const name of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Default system role for ${name}`
      }
    });
    roleMap[name] = role;
  }
  console.log("✅ Seeded roles");

  // 2. Create an Admin User
  const adminEmail = "admin@claro.com";
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync("admin123", salt);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      fullName: "System Admin",
      passwordHash,
      roleId: roleMap["Admin"].id,
      isActive: true
    }
  });
  console.log(`✅ Seeded admin user: ${adminEmail} (password: admin123)`);

  // 3. Seed states & districts
  const state = await prisma.state.upsert({
    where: { name: "California" },
    update: {},
    create: { name: "California" }
  });

  const district = await prisma.district.upsert({
    where: {
      uq_state_district: {
        stateId: state.id,
        name: "Los Angeles"
      }
    },
    update: {},
    create: {
      stateId: state.id,
      name: "Los Angeles"
    }
  });
  console.log(`✅ Seeded State: California, District: Los Angeles`);

  // 4. Seed Master Installation (This validates form submissions)
  const appId = "APP-10001";
  const installation = await prisma.masterInstallation.upsert({
    where: { applicationId: appId },
    update: {},
    create: {
      applicationId: appId,
      clientName: "Acme Corporates",
      installationDate: new Date("2026-01-15"),
      address: "123 Sunset Blvd, Los Angeles, CA",
      stateId: state.id,
      districtId: district.id
    }
  });
  console.log(`✅ Seeded Master Installation: ${appId} (Client: Acme Corporates)`);

  // 5. Create an Engineer User & Profile
  const engineerEmail = "engineer@claro.com";
  const engineerUserPass = bcrypt.hashSync("engineer123", salt);

  const engineerUser = await prisma.user.upsert({
    where: { email: engineerEmail },
    update: { passwordHash: engineerUserPass },
    create: {
      email: engineerEmail,
      fullName: "Alex Rivera",
      passwordHash: engineerUserPass,
      roleId: roleMap["Engineer"].id,
      isActive: true
    }
  });

  const engineer = await prisma.engineer.upsert({
    where: { email: engineerEmail },
    update: {
      stateId: state.id,
      districtId: district.id,
      isActive: true
    },
    create: {
      userId: engineerUser.id,
      name: "Alex Rivera",
      email: engineerEmail,
      phone: "+15550199",
      stateId: state.id,
      districtId: district.id,
      isActive: true
    }
  });
  console.log(`✅ Seeded Engineer Profile: ${engineer.name} (${engineerEmail}, password: engineer123)`);

  console.log("🌱 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
