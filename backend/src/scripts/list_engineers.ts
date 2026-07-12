import { prisma } from "../db.js";

async function run() {
  const engineers = await prisma.engineer.findMany({
    select: {
      name: true,
      email: true,
      userId: true
    }
  });
  console.log("PRODUCTION ENGINEERS:");
  console.log(engineers);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
