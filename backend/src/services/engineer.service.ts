import { prisma } from "../db.js";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export const engineerService = {
  /**
   * Upserts an engineer and their corresponding user profile within a transaction.
   * Mandates that email must be present.
   */
  async upsertEngineer(
    name: string,
    email: string | null | undefined,
    phone: string,
    stateId: string | null,
    districtId: string | null,
    tx: Prisma.TransactionClient = prisma
  ) {
    if (!email || !email.trim()) {
      console.warn(`⚠️ Cannot upsert engineer '${name}': email is mandatory.`);
      return null;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = (phone || "N/A").trim();

    // Check if engineer exists
    let engineer = await tx.engineer.findUnique({
      where: { email: cleanEmail }
    });

    if (!engineer) {
      // 1. Get or create Engineer role
      const engineerRole = await tx.role.upsert({
        where: { name: "Engineer" },
        update: {},
        create: { name: "Engineer", description: "Field Engineer" }
      });

      // 2. Create User account
      const defaultPassword = bcrypt.hashSync("engineer123", 10);
      const user = await tx.user.upsert({
        where: { email: cleanEmail },
        update: { fullName: cleanName },
        create: {
          email: cleanEmail,
          fullName: cleanName,
          passwordHash: defaultPassword,
          roleId: engineerRole.id
        }
      });

      // 3. Create Engineer Profile
      engineer = await tx.engineer.create({
        data: {
          userId: user.id,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          stateId,
          districtId
        }
      });
    } else {
      // Update engineer details if they already exist
      engineer = await tx.engineer.update({
        where: { id: engineer.id },
        data: {
          name: cleanName,
          phone: cleanPhone,
          stateId,
          districtId
        }
      });
    }

    return engineer;
  },

  /**
   * Helper to retrieve or create the default administrator user and roles.
   */
  async getAdminUser(tx: Prisma.TransactionClient = prisma) {
    const adminRole = await tx.role.upsert({
      where: { name: "Admin" },
      update: {},
      create: { name: "Admin", description: "Administrator with full system control" }
    });

    const defaultPassword = bcrypt.hashSync("admin123", 10);
    const adminUser = await tx.user.upsert({
      where: { email: "admin@claro.com" },
      update: {},
      create: {
        email: "admin@claro.com",
        fullName: "System Admin",
        passwordHash: defaultPassword,
        roleId: adminRole.id
      }
    });

    return { adminRole, adminUser };
  }
};
