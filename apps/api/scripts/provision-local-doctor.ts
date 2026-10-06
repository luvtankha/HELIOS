import { PrismaClient } from "@prisma/client";
import { hashDoctorPassword } from "../src/security/doctor-password.js";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.HELIOS_LOCAL_DATABASE !== "true" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55435" ||
  url.pathname !== "/helios"
)
  throw new Error(
    "This command provisions only the dedicated HELIOS local database.",
  );
const prisma = new PrismaClient();
try {
  const passwordHash = await hashDoctorPassword(
    process.env.DOCTOR_DEMO_ACCESS_CODE ?? "",
  );
  const doctor = await prisma.user.upsert({
    where: { username: "helios-local" },
    create: {
      username: "helios-local",
      displayName: "HELIOS Local Doctor",
      role: "DOCTOR",
      specializationId: "internal-medicine",
      acceptingRouting: true,
      passwordHash,
    },
    update: { passwordHash },
  });
  console.log(
    JSON.stringify({
      username: doctor.username,
      specialization: doctor.specializationId,
      accessCodeLocation: "Private root .env: DOCTOR_DEMO_ACCESS_CODE",
    }),
  );
} finally {
  await prisma.$disconnect();
}
