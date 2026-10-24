import { connectDB } from "@/server/db";

/** Health check for uptime monitors and deployment verification (no data exposed). */
export async function GET() {
  try {
    const mongoose = await connectDB();
    await mongoose.connection.db?.admin().ping();
    return Response.json({ ok: true, db: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
