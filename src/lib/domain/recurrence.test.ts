import { describe, expect, it } from "vitest";
import { describeRule, formatRule, nextOccurrence, parseRule } from "./recurrence";

describe("recurrence rules", () => {
  it("round-trips through the stored string", () => {
    const rule = formatRule({ frequency: "weekly", weekdays: [0, 2, 4] });
    expect(rule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(parseRule(rule)).toMatchObject({ frequency: "weekly", weekdays: [0, 2, 4] });
  });

  it("treats unparseable stored data as no repeat rather than guessing", () => {
    expect(parseRule(null)).toBeNull();
    expect(parseRule("")).toBeNull();
    expect(parseRule("FREQ=FORTNIGHTLY")).toBeNull();
    expect(nextOccurrence("nonsense", "2026-09-07")).toBeNull();
  });
});

describe("the next date a rule lands on", () => {
  it("daily is tomorrow", () => {
    expect(nextOccurrence("FREQ=DAILY", "2026-09-07")).toBe("2026-09-08");
  });

  it("weekly with no days chosen is a week on", () => {
    expect(nextOccurrence("FREQ=WEEKLY", "2026-09-07")).toBe("2026-09-14");
  });

  it("weekly picks the next chosen weekday", () => {
    // 2026-09-07 is a Monday. Mon/Wed/Fri: next is Wednesday the 9th.
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-09-07")).toBe("2026-09-09");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-09-09")).toBe("2026-09-11");
    // From Friday it wraps to Monday.
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-09-11")).toBe("2026-09-14");
  });

  it("weekly on a single day is that day next week", () => {
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=SA", "2026-09-07")).toBe("2026-09-12");
  });

  it("monthly lands later this month when the day has not passed", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=15", "2026-09-07")).toBe("2026-09-15");
  });

  it("monthly rolls to next month when it has", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=15", "2026-09-15")).toBe("2026-10-15");
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=1", "2026-09-20")).toBe("2026-10-01");
  });

  it("monthly rolls over the year end", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=5", "2026-12-10")).toBe("2027-01-05");
  });

  it("pulls the 31st back rather than skipping a short month", () => {
    // Rent on the 31st. September has 30 days, February 2027 has 28.
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-08-31")).toBe("2026-09-30");
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2027-01-31")).toBe("2027-02-28");
    // And it does not get stuck on the short month: March is the 31st again.
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2027-02-28")).toBe("2027-03-31");
  });

  it("handles a leap February", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=30", "2028-01-30")).toBe("2028-02-29");
  });

  it("yearly lands on the same date next year", () => {
    expect(nextOccurrence("FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=15", "2026-04-15")).toBe(
      "2027-04-15",
    );
  });

  it("yearly lands later this year when the date is still ahead", () => {
    expect(nextOccurrence("FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25", "2026-09-07")).toBe(
      "2026-12-25",
    );
  });

  it("always moves forward, never returns the date it was given", () => {
    const rules = [
      "FREQ=DAILY",
      "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU",
      "FREQ=MONTHLY;BYMONTHDAY=7",
      "FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=7",
    ];
    for (const rule of rules) {
      const next = nextOccurrence(rule, "2026-09-07");
      expect(next, rule).not.toBeNull();
      expect(next!.localeCompare("2026-09-07"), rule).toBeGreaterThan(0);
    }
  });
});

describe("describing a rule in words", () => {
  it("names the days for a weekly rule", () => {
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toBe("Every week on Mon, Wed, Fri");
  });

  it("uses an ordinal for a monthly rule", () => {
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=1")).toBe("Every month on the 1st");
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=2")).toBe("Every month on the 2nd");
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=3")).toBe("Every month on the 3rd");
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=11")).toBe("Every month on the 11th");
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=21")).toBe("Every month on the 21st");
    expect(describeRule("FREQ=MONTHLY;BYMONTHDAY=31")).toBe("Every month on the 31st");
  });

  it("says nothing for a task that does not repeat", () => {
    expect(describeRule(null)).toBeNull();
  });
});
