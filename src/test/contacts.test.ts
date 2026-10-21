import { describe, expect, it } from "vitest";
import { normalizePhone, findPhones, findEmails } from "@/lib/contacts/phone";
import { whatsappUrl, renderTemplate, shareDetailsText } from "@/lib/contacts/whatsapp";
import { findDuplicates, mergePreserving } from "@/lib/contacts/duplicates";
import { shouldPrompt, MAX_AGE_MS, type PendingCall } from "@/lib/contacts/call-followup";
import { draftsFromAI } from "@/lib/contacts/postprocess";
import { toCSV } from "@/lib/contacts/export";
import { analyze } from "@/lib/contacts/review";
import { autoMapping } from "@/lib/contacts/spreadsheet";

describe("spreadsheet column mapping", () => {
  it("maps common header names", () => {
    expect(autoMapping(["Company", "Contact Person", "Phone"])).toEqual(["company", "full_name", "phone"]);
    expect(autoMapping(["Name", "Mobile No", "Email ID", "WhatsApp", "City"])).toEqual(["full_name", "phone", "email", "whatsapp_phone", "city"]);
  });
});

describe("phone normalization", () => {
  it("normalizes Indian mobiles without country code", () => {
    expect(normalizePhone("9876543210").e164).toBe("+919876543210");
    expect(normalizePhone("+91 98765-43210").e164).toBe("+919876543210");
    expect(normalizePhone("09876543210").e164).toBe("+919876543210");
  });
  it("rejects incomplete numbers", () => {
    expect(normalizePhone("98765").valid).toBe(false);
  });
  it("finds phones and emails in pasted text", () => {
    const t = "Rahul Sharma, +91 9876543210, rahul@example.com, Indore\nPriya Verma, 9123456780, priya@example.com, Bhopal";
    expect(findPhones(t)).toEqual(["+919876543210", "+919123456780"]);
    expect(findEmails(t)).toEqual(["rahul@example.com", "priya@example.com"]);
  });
});

describe("whatsapp", () => {
  it("builds an encoded wa.me url with digits only", () => {
    expect(whatsappUrl("+919876543210", "Hi Rahul & co")).toBe("https://wa.me/919876543210?text=Hi%20Rahul%20%26%20co");
  });
  it("returns null for invalid numbers", () => {
    expect(whatsappUrl("123", "x")).toBeNull();
  });
  it("fills placeholders", () => {
    expect(renderTemplate("Hello {{name}} from {{company}}", { full_name: "Rahul Sharma", company: "Acme" })).toBe("Hello Rahul Sharma from Acme");
  });
  it("shares only selected, present fields", () => {
    expect(shareDetailsText({ full_name: "Rahul", phone: "+919876543210", email: null }, ["full_name", "phone", "email"])).toBe(
      "Name: Rahul\nPhone: +91 98765 43210",
    );
  });
});

describe("duplicates", () => {
  const existing = [{ id: "a", full_name: "Rahul Sharma", phone: "+919876543210", email: "r@x.com" }];
  it("matches on phone strongly", () => {
    expect(findDuplicates({ phone: "+919876543210" }, existing)).toEqual([{ id: "a", reason: "phone", strong: true }]);
  });
  it("matches on email strongly, case-insensitive", () => {
    expect(findDuplicates({ email: "R@X.com" }, existing)[0]).toMatchObject({ reason: "email", strong: true });
  });
  it("name-only match is weak", () => {
    expect(findDuplicates({ full_name: "rahul sharma" }, existing)[0]).toMatchObject({ reason: "name", strong: false });
  });
  it("merge preserves existing values", () => {
    expect(mergePreserving({ full_name: "Rahul", city: null }, { full_name: "R. Sharma", city: "Indore" })).toEqual({ full_name: "Rahul", city: "Indore" });
  });
  it("flags repeated numbers inside one import", () => {
    const d = draftsFromAI(
      [{ full_name: "A", phone: "9876543210", confidence: 0.9 }, { full_name: "B", phone: "+91 9876543210", confidence: 0.9 }],
      { country: "IN", sourceFilename: null, sourceType: "text" },
    );
    expect(analyze(d, [], "IN").map((r) => r.status)).toEqual(["valid", "duplicate"]);
  });
});

describe("AI post-processing", () => {
  it("drops numbers the AI invented that are not in the source text", () => {
    const d = draftsFromAI([{ full_name: "Rahul", phone: "9999988888", confidence: 0.9 }], {
      sourceText: "Rahul, 9876543210",
      country: "IN",
      sourceFilename: null,
      sourceType: "text",
    });
    expect(d[0]!.fields.phone).toBe(null);
    // the real number is recovered as a separate partial contact
    expect(d[1]!.fields.phone).toBe("+919876543210");
  });
});

describe("call follow-up prompt", () => {
  const base: PendingCall = { contactId: "c", name: "R", phone: "+91", activityId: null, startedAt: 0, leftAppAt: 1000, handled: false };
  it("shows after returning from the dialer", () => expect(shouldPrompt(base, 10_000)).toBe(true));
  it("does not repeat once handled", () => expect(shouldPrompt({ ...base, handled: true }, 10_000)).toBe(false));
  it("is discarded when stale", () => expect(shouldPrompt(base, MAX_AGE_MS + 1)).toBe(false));
  it("needs the user to have left the app", () => expect(shouldPrompt({ ...base, leftAppAt: null }, 10_000)).toBe(false));
});

describe("export", () => {
  it("keeps phone numbers as text with leading +", () => {
    expect(toCSV([{ full_name: "A, B", phone: "+919876543210" }], ["full_name", "phone"])).toBe('\uFEFFFull name,Mobile\r\n"A, B",+919876543210');
  });
});
