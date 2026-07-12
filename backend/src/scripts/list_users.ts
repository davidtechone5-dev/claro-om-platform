import { prisma } from "../db.js";

async function run() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: { select: { name: true } }
    }
  });
  console.log("PRODUCTION USERS:");
  console.log(users);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
