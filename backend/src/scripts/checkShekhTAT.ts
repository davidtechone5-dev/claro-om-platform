import { prisma } from "../db.js";

async function main() {
  const eng = await prisma.engineer.findFirst({
    where: {
      name: { contains: "Shekh Shafi", mode: "insensitive" }
    }
  });

  if (!eng) {
    console.log("❌ Engineer 'Shekh Shafi' not found in database.");
    return;
  }

  console.log(`\n=============================================`);
  console.log(`👤 Found Engineer: ${eng.name}`);
  console.log(`=============================================`);

  const assignments = await prisma.ticketAssignment.findMany({
    where: { engineerId: eng.id, deletedAt: null },
    include: {
      ticket: {
        include: {
          serviceReports: { where: { deletedAt: null }, orderBy: { reportDate: "desc" } }
        }
      }
    }
  });

  let tatSum = 0;
  let validTatCount = 0;
  let resolvedCount = 0;

  assignments.forEach(a => {
    const t = a.ticket;
    if (t.status === "RESOLVED") {
      resolvedCount++;
      let overallTat: number | null = null;
      if (t.metadata && typeof t.metadata === "object") {
        const meta = t.metadata as Record<string, any>;
        const val = meta["Overall TAT (days)"] ?? meta["overall_tat_days"] ?? meta["Overall TAT"] ?? meta["overall_tat"];
        if (val !== undefined && val !== null && val !== "") {
          const num = parseFloat(val);
          if (!isNaN(num) && num >= 0) {
            overallTat = num;
          }
        }
      }

      if (overallTat !== null) {
        tatSum += overallTat;
        validTatCount++;
      }
    }
  });

  const avgTat = validTatCount > 0 ? (tatSum / validTatCount).toFixed(1) : "0";
  console.log(`Resolved Tickets:              ${resolvedCount}`);
  console.log(`Tickets with overall TAT values: ${validTatCount}`);
  console.log(`Sum of Overall TAT values:     ${tatSum}`);
  console.log(`Calculated Average TAT:        ${avgTat}d`);
  console.log(`=============================================\n`);
}

main().catch(console.error);
