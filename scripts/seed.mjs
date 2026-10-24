// Optional sample data for trying out CreatorsHub. Every record is flagged `isSample: true`
// and shows a "Sample" badge in the UI. Remove it with `npm run seed:clear` or from Settings.
//
// Usage: npm run seed [-- --email you@example.com]
//        npm run seed:clear
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (expected in .env.local).");
  process.exit(1);
}

const args = process.argv.slice(2);
const clear = args.includes("--clear");
const emailIdx = args.indexOf("--email");
const email = emailIdx >= 0 ? args[emailIdx + 1]?.toLowerCase() : undefined;

const loose = (name, collection) =>
  mongoose.models[name] ?? mongoose.model(name, new mongoose.Schema({}, { strict: false, timestamps: true }), collection);
const User = loose("User", "users");
const Brand = loose("Brand", "brands");
const Collaboration = loose("Collaboration", "collaborations");
const Payment = loose("Payment", "payments");
const Task = loose("Task", "tasks");
const Activity = loose("Activity", "activities");

function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(d, n) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  const user = email ? await User.findOne({ email }).lean() : await User.findOne().sort({ createdAt: 1 }).lean();
  if (!user) throw new Error(email ? `No user with email ${email}` : "Create your account in the app first, then run the seed.");
  const userId = user._id;
  const filter = { userId, isSample: true };

  const removed = await Promise.all([Collaboration, Payment, Task, Activity, Brand].map((m) => m.deleteMany(filter)));
  console.log(`Removed ${removed.reduce((n, r) => n + r.deletedCount, 0)} existing sample records.`);
  if (clear) process.exit(0);

  const t = todayIn(user.settings?.timezone ?? "Asia/Kolkata");
  const brandsSpec = [
    { name: "Nike", contactName: "Arjun Mehta", email: "arjun@nike.example" },
    { name: "GlowSkin", contactName: "Priya Sharma", email: "priya@glowskin.example" },
    { name: "Boat", contactName: "Rahul Verma", email: "rahul@boat.example" },
    { name: "Notion Agency", contactName: "Sara Khan", email: "sara@notionagency.example" },
    { name: "Mamaearth", contactName: "Neha Gupta", email: "neha@mamaearth.example" },
  ];
  const brands = {};
  for (const b of brandsSpec) {
    // Reuse a real brand with the same name instead of creating a duplicate.
    const existing = await Brand.findOne({ userId, nameKey: key(b.name) }, { _id: 1 }).lean();
    const doc = existing ?? (await Brand.create({ ...b, userId, nameKey: key(b.name), phone: "", website: "", notes: "", isSample: true }));
    brands[b.name] = doc._id;
  }

  const base = {
    userId,
    isSample: true,
    contactPhone: "",
    description: "",
    notes: "",
    links: [],
    currency: "INR",
    invoiceNumber: "",
    invoiceUrl: "",
    invoiceSentOn: null,
    paymentNotes: "",
    receivedMinor: 0,
    startDate: null,
    responseDeadline: null,
    submissionDeadline: null,
    publishDate: null,
    paymentDueDate: null,
    followUpOn: null,
  };
  const d = (title, platform, dueDate, status = "todo") => ({ _id: new mongoose.Types.ObjectId(), title, platform, dueDate, status, notes: "" });

  const collabs = await Collaboration.insertMany([
    {
      ...base, brandId: brands.Nike, brandName: "Nike", title: "Air Max running reel", contactName: "Arjun Mehta", contactEmail: "arjun@nike.example",
      platforms: ["instagram"], type: "paid", source: "email", status: "in_progress", inquiryDate: addDays(t, -20),
      submissionDeadline: addDays(t, 1), publishDate: addDays(t, 4), paymentDueDate: addDays(t, 34), amountMinor: 45_000_00, receivedMinor: 15_000_00,
      deliverables: [d("1 Instagram Reel", "instagram", addDays(t, 1), "in_progress"), d("2 Instagram Stories", "instagram", addDays(t, 4))],
      paymentNotes: "1/3 advance received",
    },
    {
      ...base, brandId: brands.GlowSkin, brandName: "GlowSkin", title: "Glow Serum launch", contactName: "Priya Sharma", contactEmail: "priya@glowskin.example",
      platforms: ["instagram", "youtube"], type: "paid", source: "email", status: "new_lead", inquiryDate: addDays(t, -1), responseDeadline: t, amountMinor: 25_000_00, deliverables: [],
    },
    {
      ...base, brandId: brands.Boat, brandName: "Boat", title: "Earbuds YouTube integration", contactName: "Rahul Verma", contactEmail: "rahul@boat.example",
      platforms: ["youtube"], type: "paid", source: "referral", status: "completed", inquiryDate: addDays(t, -60), publishDate: addDays(t, -35),
      paymentDueDate: addDays(t, -5), amountMinor: 60_000_00, receivedMinor: 30_000_00, invoiceNumber: "INV-2026-014", invoiceSentOn: addDays(t, -34),
      deliverables: [d("1 YouTube Integration", "youtube", addDays(t, -36), "published")],
    },
    {
      ...base, brandId: brands["Notion Agency"], brandName: "Notion Agency", title: "Productivity tools carousel", contactName: "Sara Khan",
      contactEmail: "sara@notionagency.example", platforms: ["linkedin", "instagram"], type: "paid", source: "instagram_dm", status: "negotiating",
      inquiryDate: addDays(t, -8), followUpOn: addDays(t, -1), amountMinor: 18_000_00, deliverables: [],
    },
    {
      ...base, brandId: brands.Mamaearth, brandName: "Mamaearth", title: "Winter skincare barter", contactName: "Neha Gupta", contactEmail: "neha@mamaearth.example",
      platforms: ["instagram"], type: "barter", source: "whatsapp", status: "awaiting_approval", inquiryDate: addDays(t, -15), publishDate: addDays(t, 6),
      followUpOn: addDays(t, 2), amountMinor: 0, deliverables: [d("1 Instagram Reel", "instagram", addDays(t, -2), "submitted")],
    },
  ]);
  const [nike, , boat] = collabs;

  await Payment.insertMany([
    { userId, isSample: true, collaborationId: nike._id, amountMinor: 15_000_00, currency: "INR", receivedOn: addDays(t, -12), method: "bank_transfer", reference: "UTR8812", notes: "Advance" },
    { userId, isSample: true, collaborationId: boat._id, amountMinor: 30_000_00, currency: "INR", receivedOn: addDays(t, -20), method: "upi", reference: "", notes: "50% on posting" },
  ]);
  await Task.insertMany([
    { userId, isSample: true, collaborationId: nike._id, title: "Shoot B-roll for Nike reel", dueDate: t, priority: "high", done: false, completedAt: null, notes: "" },
    { userId, isSample: true, collaborationId: null, title: "Update media kit with October stats", dueDate: addDays(t, 3), priority: "medium", done: false, completedAt: null, notes: "" },
    { userId, isSample: true, collaborationId: null, title: "Renew editing software subscription", dueDate: addDays(t, -1), priority: "low", done: false, completedAt: null, notes: "" },
  ]);
  await Activity.insertMany(
    collabs.map((c) => ({ userId, isSample: true, collaborationId: c._id, kind: "created", message: "Added from sample data" })),
  );
  console.log(`Seeded ${collabs.length} sample collaborations for ${user.email}.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
