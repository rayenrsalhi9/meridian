import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CLAIMS = [
  { key: "USER_MANAGE", description: "Create, read, update, and delete users" },
  {
    key: "ROLE_MANAGE",
    description: "Create, read, update, and delete roles and claims",
  },
  { key: "DOCUMENT_CREATE", description: "Upload new documents" },
  {
    key: "DOCUMENT_MANAGE",
    description: "Edit, delete, and manage document access",
  },
  {
    key: "DOCUMENT_CATEGORY_MANAGE",
    description: "Manage document categories",
  },
  {
    key: "CHAT_MODERATE",
    description: "Moderate chat conversations and messages",
  },
  { key: "FORUM_VIEW", description: "View forum posts and comments" },
  { key: "FORUM_MANAGE", description: "Create, edit, delete forum posts" },
  { key: "FORUM_CATEGORY_MANAGE", description: "Manage forum categories" },
  { key: "DASHBOARD_VIEW", description: "View the system dashboard" },
] as const;

async function main() {
  console.log("Seeding claims...");
  const claimRecords = await Promise.all(
    CLAIMS.map((c) =>
      prisma.claim.upsert({
        where: { key: c.key },
        update: { description: c.description },
        create: { key: c.key, description: c.description },
      }),
    ),
  );

  console.log("Seeding Admin role...");
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin" },
  });

  console.log("Attaching all claims to Admin role...");
  await Promise.all(
    claimRecords.map((claim) =>
      prisma.roleClaim.upsert({
        where: { roleId_claimId: { roleId: adminRole.id, claimId: claim.id } },
        update: {},
        create: { roleId: adminRole.id, claimId: claim.id },
      }),
    ),
  );

  console.log("Seeding Admin user...");
  const passwordHash = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@meridian.local" },
    update: {},
    create: {
      email: "admin@meridian.local",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
    },
  });

  console.log("Assigning Admin role to Admin user...");
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
