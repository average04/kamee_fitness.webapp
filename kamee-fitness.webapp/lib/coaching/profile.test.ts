import { describe, expect, it } from "vitest";
import {
  coerceProfileInput,
  MISSING_LABELS,
  parseCredentialForm,
  parseProfileForm,
  profileFormStateFromRow,
  profileInputFromFormState,
  validateCredential,
  validateProfile,
} from "./profile";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("parseProfileForm", () => {
  it("splits comma lists, trims, coerces numbers", () => {
    const i = parseProfileForm(
      fd({
        headline: " Run coach ",
        about: "a",
        specialties: "5k, marathon ,",
        years_experience: "7",
        languages: "en,fil",
        location_label: "Cebu",
        instagram: "@jo",
        website: "https://jo.run",
        is_accepting_clients: "on",
        response_days: "2",
        terms_accepted: "on",
      }),
    );
    expect(i.headline).toBe("Run coach");
    expect(i.specialties).toEqual(["5k", "marathon"]);
    expect(i.yearsExperience).toBe(7);
    expect(i.languages).toEqual(["en", "fil"]);
    expect(i.socials).toEqual({ instagram: "@jo", website: "https://jo.run" });
    expect(i.isAcceptingClients).toBe(true);
    expect(i.responseDays).toBe(2);
    expect(i.termsAccepted).toBe(true);
  });
  it("defaults missing fields", () => {
    const i = parseProfileForm(fd({}));
    expect(i.yearsExperience).toBeNull();
    expect(i.specialties).toEqual([]);
    expect(i.responseDays).toBe(3);
    expect(i.isAcceptingClients).toBe(false);
  });
});

describe("validateProfile", () => {
  const base = parseProfileForm(
    fd({ headline: "x", about: "y".repeat(80), response_days: "3" }),
  );
  it("accepts a minimal valid profile", () => {
    expect(validateProfile(base).ok).toBe(true);
  });
  it("rejects headline over 80 and about over 2000", () => {
    const r = validateProfile({
      ...base,
      headline: "h".repeat(81),
      about: "a".repeat(2001),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.headline).toBeTruthy();
      expect(r.errors.about).toBeTruthy();
    }
  });
  it("rejects more than 8 specialties, response_days outside 1-7, non-https website", () => {
    const r = validateProfile({
      ...base,
      specialties: Array(9).fill("s"),
      responseDays: 9,
      socials: { website: "ftp://x" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        "responseDays",
        "specialties",
        "website",
      ]);
    }
  });
});

describe("credentials", () => {
  it("parses and validates", () => {
    const i = parseCredentialForm(
      fd({
        title: "RRCA Level 1",
        issuer: "RRCA",
        issued_year: "2021",
        expires_on: "",
      }),
    );
    expect(i).toEqual({
      title: "RRCA Level 1",
      issuer: "RRCA",
      issuedYear: 2021,
      expiresOn: null,
    });
    expect(validateCredential(i).ok).toBe(true);
    expect(validateCredential({ ...i, title: "" }).ok).toBe(false);
    expect(validateCredential({ ...i, issuedYear: 1800 }).ok).toBe(false);
    expect(validateCredential({ ...i, expiresOn: "not-a-date" }).ok).toBe(
      false,
    );
  });
});

describe("MISSING_LABELS", () => {
  it("covers every key the RPC can return", () => {
    for (const k of [
      "headline",
      "about",
      "avatar",
      "cover",
      "credential",
      "gallery",
      "terms",
    ])
      expect(MISSING_LABELS[k]).toBeTruthy();
  });
});

const row = {
  headline: "Run coach",
  about: "y".repeat(80),
  specialties: ["5k", "marathon"],
  years_experience: 7,
  languages: ["en", "fil"],
  location_label: "Cebu",
  socials: { instagram: "@jo", website: "https://jo.run" },
  is_accepting_clients: true,
  response_days: 2,
  terms_accepted_at: "2026-09-01T00:00:00Z",
};

describe("profileFormStateFromRow", () => {
  it("maps a coaching_profiles row into editable string fields", () => {
    expect(profileFormStateFromRow(row)).toEqual({
      headline: "Run coach",
      about: "y".repeat(80),
      specialties: "5k, marathon",
      yearsExperience: "7",
      languages: "en, fil",
      locationLabel: "Cebu",
      instagram: "@jo",
      website: "https://jo.run",
      responseDays: 2,
      isAcceptingClients: true,
      termsAccepted: true,
    });
  });

  it("falls back to blanks/false for nulls and an empty socials object", () => {
    const s = profileFormStateFromRow({
      headline: null,
      about: null,
      specialties: [],
      years_experience: null,
      languages: [],
      location_label: null,
      socials: {},
      is_accepting_clients: false,
      response_days: 3,
      terms_accepted_at: null,
    });
    expect(s.headline).toBe("");
    expect(s.about).toBe("");
    expect(s.specialties).toBe("");
    expect(s.yearsExperience).toBe("");
    expect(s.instagram).toBe("");
    expect(s.website).toBe("");
    expect(s.termsAccepted).toBe(false);
  });
});

describe("profileInputFromFormState", () => {
  it("round-trips a form state back into a ProfileInput", () => {
    const s = profileFormStateFromRow(row);
    expect(profileInputFromFormState(s)).toEqual({
      headline: "Run coach",
      about: "y".repeat(80),
      specialties: ["5k", "marathon"],
      yearsExperience: 7,
      languages: ["en", "fil"],
      locationLabel: "Cebu",
      socials: { instagram: "@jo", website: "https://jo.run" },
      isAcceptingClients: true,
      responseDays: 2,
      termsAccepted: true,
    });
  });

  it("trims comma lists and drops blanks", () => {
    const s = profileFormStateFromRow(row);
    const i = profileInputFromFormState({ ...s, specialties: " 5k, marathon ,, ultra " });
    expect(i.specialties).toEqual(["5k", "marathon", "ultra"]);
  });

  it("omits blank socials rather than sending empty strings", () => {
    const s = profileFormStateFromRow(row);
    const i = profileInputFromFormState({ ...s, instagram: "  ", website: "" });
    expect(i.socials).toEqual({});
  });

  it("treats a blank or non-numeric years field as null, never NaN", () => {
    const s = profileFormStateFromRow(row);
    expect(profileInputFromFormState({ ...s, yearsExperience: "" }).yearsExperience).toBeNull();
    expect(profileInputFromFormState({ ...s, yearsExperience: "abc" }).yearsExperience).toBeNull();
  });

  it("trims a whitespace-only headline/about/location to empty so they never pass the checklist", () => {
    const s = profileFormStateFromRow(row);
    const i = profileInputFromFormState({
      ...s,
      headline: "   ",
      about: "   ",
      locationLabel: "   ",
    });
    expect(i.headline).toBe("");
    expect(i.about).toBe("");
    expect(i.locationLabel).toBe("");
  });
});

describe("coerceProfileInput", () => {
  const validRaw = {
    headline: " Run coach ",
    about: "y".repeat(80),
    specialties: ["5k", " marathon ", ""],
    yearsExperience: 7,
    languages: ["en", "fil"],
    locationLabel: "Cebu",
    socials: { instagram: "@jo", website: "https://jo.run", extra: "nope" },
    isAcceptingClients: true,
    responseDays: 2,
    termsAccepted: true,
  };

  it("accepts a well-formed shape: trims strings, drops empty array items, rebuilds socials from only instagram/website", () => {
    expect(coerceProfileInput(validRaw)).toEqual({
      headline: "Run coach",
      about: "y".repeat(80),
      specialties: ["5k", "marathon"],
      yearsExperience: 7,
      languages: ["en", "fil"],
      locationLabel: "Cebu",
      socials: { instagram: "@jo", website: "https://jo.run" },
      isAcceptingClients: true,
      responseDays: 2,
      termsAccepted: true,
    });
  });

  it("returns null for non-object input", () => {
    expect(coerceProfileInput(null)).toBeNull();
    expect(coerceProfileInput("nope")).toBeNull();
    expect(coerceProfileInput(42)).toBeNull();
    expect(coerceProfileInput(undefined)).toBeNull();
  });

  it("returns null when a string field has the wrong type", () => {
    expect(coerceProfileInput({ ...validRaw, headline: 123 })).toBeNull();
  });

  it("returns null when an array field contains a non-string item, or isn't an array", () => {
    expect(coerceProfileInput({ ...validRaw, specialties: ["5k", 7] })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, languages: "en,fil" })).toBeNull();
  });

  it("treats a whitespace-only headline as empty, not invalid", () => {
    expect(coerceProfileInput({ ...validRaw, headline: "   " })?.headline).toBe("");
  });

  it("requires isAcceptingClients/termsAccepted to be strictly boolean -- 'no' is not true", () => {
    expect(coerceProfileInput({ ...validRaw, isAcceptingClients: "no" })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, isAcceptingClients: 1 })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, termsAccepted: "yes" })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, termsAccepted: 0 })).toBeNull();
  });

  it("accepts a null yearsExperience but rejects a non-finite or non-numeric one", () => {
    expect(coerceProfileInput({ ...validRaw, yearsExperience: null })?.yearsExperience).toBeNull();
    expect(coerceProfileInput({ ...validRaw, yearsExperience: Number.POSITIVE_INFINITY })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, yearsExperience: "7" })).toBeNull();
  });

  it("rejects a non-numeric or non-finite responseDays", () => {
    expect(coerceProfileInput({ ...validRaw, responseDays: "2" })).toBeNull();
    expect(coerceProfileInput({ ...validRaw, responseDays: Number.NaN })).toBeNull();
  });

  it("drops unknown socials keys and tolerates a missing socials object", () => {
    const { socials, ...rest } = validRaw;
    void socials;
    expect(coerceProfileInput(rest)?.socials).toEqual({});
  });
});
