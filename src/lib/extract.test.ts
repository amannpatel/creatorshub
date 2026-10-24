import { describe, expect, it } from "vitest";
import { extractCollaboration, findAmounts } from "./extract";

const today = "2026-10-24"; // Saturday

const EMAIL = `From: Priya Sharma <priya@glowskin.in>
Subject: Paid collaboration – Glow Serum launch

Hi!

I'm Priya from GlowSkin. We'd love to collaborate with you for our Glow Serum campaign.
Deliverables: 1 Instagram Reel and 2 Instagram Stories.
Our budget for this is ₹25,000 (50% advance).
Please share the draft by 5th November and the reel should go live on 10 Nov 2026.
Payment will be made within 30 days of posting.
Kindly let us know by Monday if you're interested.

Best regards,
Priya Sharma
+91 98765 43210`;

describe("extractCollaboration", () => {
  const r = extractCollaboration(EMAIL, today);

  it("finds brand, contact and source", () => {
    expect(r.brandName).toBe("GlowSkin");
    expect(r.contactName).toBe("Priya Sharma");
    expect(r.contactEmail).toBe("priya@glowskin.in");
    expect(r.contactPhone).toContain("98765");
    expect(r.source).toBe("email");
    expect(r.title).toBe("Paid collaboration – Glow Serum launch");
  });

  it("finds amount, type and deliverables", () => {
    expect(r.amountMinor).toBe(25_000_00);
    expect(r.currency).toBe("INR");
    expect(r.type).toBe("paid");
    expect(r.platforms).toContain("instagram");
    expect(r.deliverables.map((d) => d.title)).toEqual(["1 Instagram Reel", "2 Instagram Stories"]);
  });

  it("classifies dates by context and computes payment terms", () => {
    expect(r.submissionDeadline).toBe("2026-11-05");
    expect(r.publishDate).toBe("2026-11-10");
    expect(r.responseDeadline).toBe("2026-10-26"); // next Monday
    expect(r.paymentDueDate).toBe("2026-12-10");
  });

  it("collects requested actions", () => {
    expect(r.actions.some((a) => a.startsWith("Please share the draft"))).toBe(true);
  });

  it("handles short DMs with k-suffix amounts and gifted offers", () => {
    const dm = extractCollaboration("hey! we're the team at Bloom Co, can we send you our PR package? no fee, it's gifted. 1 reel please", today);
    expect(dm.brandName).toBe("Bloom Co");
    expect(dm.type).toBe("gifted");
    expect(dm.amountMinor).toBeNull();
    expect(extractCollaboration("Budget is 15k for 1 YouTube integration", today).amountMinor).toBe(15_000_00);
  });

  it("does not invent data for unrelated text", () => {
    const x = extractCollaboration("hello there, hope you are well", today);
    expect(x.brandName).toBeNull();
    expect(x.amountMinor).toBeNull();
    expect(x.deliverables).toEqual([]);
  });
});

describe("findAmounts", () => {
  it("understands Indian and international formats", () => {
    expect(findAmounts("Rs. 1,50,000")[0]).toMatchObject({ minor: 150_000_00, currency: "INR" });
    expect(findAmounts("fee: $1,200")[0]).toMatchObject({ minor: 1_200_00, currency: "USD" });
    expect(findAmounts("2 lakh INR")[0]).toMatchObject({ minor: 200_000_00, currency: "INR" });
    expect(findAmounts("5000/-")[0]).toMatchObject({ minor: 5_000_00, currency: "INR" });
  });
});
