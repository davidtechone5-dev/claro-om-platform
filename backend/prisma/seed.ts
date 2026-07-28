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

  // 2.5. Create a Warehouse Manager User
  const warehouseEmail = "warehouse@claro.com";
  const warehousePasswordHash = bcrypt.hashSync("warehouse123", salt);
  const warehouseUser = await prisma.user.upsert({
    where: { email: warehouseEmail },
    update: { passwordHash: warehousePasswordHash },
    create: {
      email: warehouseEmail,
      fullName: "Jalna Warehouse Manager",
      passwordHash: warehousePasswordHash,
      roleId: roleMap["Warehouse"].id,
      isActive: true
    }
  });
  console.log(`✅ Seeded warehouse manager: ${warehouseEmail} (password: warehouse123)`);

  // 2.5.5. Seed Manufacturers
  const manufacturers = ["Crompton", "Luby Pumps", "Taro Motors"];
  for (const name of manufacturers) {
    await prisma.manufacturer.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log("✅ Seeded manufacturers");

  // 2.6. Seed Warehouses
  const warehouses = [
    { name: "Jalna (Xuberant)", code: "JAL", stateCode: "MH" },
    { name: "Tirupati", code: "TIR", stateCode: "AP" }
  ];
  for (const w of warehouses) {
    await prisma.warehouse.upsert({
      where: { name: w.name },
      update: { code: w.code, stateCode: w.stateCode },
      create: { name: w.name, code: w.code, stateCode: w.stateCode }
    });
  }
  console.log("✅ Seeded warehouses");

  // 2.7. Seed Parts (SKUs)
  const defaultParts = [
    { code: "SSP11M103AES005", description: "5HP AC Mono Solar Motor", category: "Motor", hpRating: "5HP", serialTracked: true, valuationAmount: 10000.0 },
    { code: "SSP11S102ANN040", description: "5HP DC Mono Solar Controller PCB", category: "Controller", hpRating: "5HP", serialTracked: true, valuationAmount: 4000.0 },
    { code: "SSP11P118AFY005", description: "7.5HP AC 30M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "7.5HP", serialTracked: true, valuationAmount: 10000.0 },
    { code: "SSP11S100AMS040", description: "Remote Monitoring System 4G+GPS", category: "RMS", hpRating: "N/A", serialTracked: true, valuationAmount: 2500.0 },
    { code: "SSP11P109AFY005", description: "5HP DC 100M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "5HP", serialTracked: true, valuationAmount: 10000.0 },

    // User's catalog parts:
    { code: "SSP11P118AFY003", description: "3hp Ac 30M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "3HP", serialTracked: true, valuationAmount: 8000.0 },
    { code: "SSP11P118AFY004", description: "3hp Ac 50M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "3HP", serialTracked: true, valuationAmount: 9000.0 },
    { code: "SSP11P109AFY003", description: "5hp Dc 30M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "5HP", serialTracked: true, valuationAmount: 8500.0 },
    { code: "SSP11P109AFY004", description: "5HP Dc 50M Mono Solar Bare Pump", category: "Bare Pump", hpRating: "5HP", serialTracked: true, valuationAmount: 9500.0 },
    { code: "SSP11M103AES003", description: "3HP Ac Mono Solar Motor", category: "Motor", hpRating: "3HP", serialTracked: true, valuationAmount: 7500.0 },
    { code: "SSP11M103AES004", description: "5hp Dc Mono Solar Motor", category: "Motor", hpRating: "5HP", serialTracked: true, valuationAmount: 9000.0 },
    { code: "SSP11S102ANN003", description: "3HP Ac Mono Solar Controller Power Pcb", category: "Controller", hpRating: "3HP", serialTracked: true, valuationAmount: 3500.0 },
    { code: "SSP11S102ANN004", description: "5hp Dc Mono Solar Controller Power Pcb", category: "Controller", hpRating: "5HP", serialTracked: true, valuationAmount: 4200.0 },
    { code: "SSP11E101MCB001", description: "2P 16A 500V DC MCB UPTO 5HP", category: "MCB", hpRating: "N/A", serialTracked: true, valuationAmount: 400.0 },
    { code: "SSP11E101SPD001", description: "SPPV3T2-1000 DC SPD CLASS II 1000V", category: "SPD", hpRating: "N/A", serialTracked: true, valuationAmount: 600.0 },
    { code: "SSP11E101CON001", description: "Mc 4 Pv Cable Connector Pair", category: "Connector", hpRating: "N/A", serialTracked: true, valuationAmount: 150.0 },
    { code: "SSP11E101CON002", description: "3-Pin Cableconnector Pair30A 500V AC", category: "Connector", hpRating: "N/A", serialTracked: true, valuationAmount: 200.0 },
    { code: "SSP11S100AMS041", description: "Remote Monittoring System 4g+Gps+Dispaly", category: "RMS", hpRating: "N/A", serialTracked: true, valuationAmount: 3000.0 }
  ];
  for (const part of defaultParts) {
    await prisma.part.upsert({
      where: { code: part.code },
      update: { 
        description: part.description, 
        valuationAmount: part.valuationAmount,
        category: part.category,
        hpRating: part.hpRating,
        serialTracked: part.serialTracked
      },
      create: {
        code: part.code,
        description: part.description,
        valuationAmount: part.valuationAmount,
        category: part.category,
        hpRating: part.hpRating,
        serialTracked: part.serialTracked
      }
    });
  }
  console.log("✅ Seeded default parts");
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
