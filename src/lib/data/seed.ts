import { DEFAULT_TIME_ZONE, isoDate, minutesOfDay } from "@/lib/domain/time";
import type {
  AvailabilityWindow,
  Commitment,
  SchedulerSettings,
  Task,
  TaskCategory,
  TaskLocation,
} from "@/lib/domain/types";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

/** The seed week template from `schema.sql`, as domain objects. */
export const SEED_WINDOWS: Omit<AvailabilityWindow, "id" | "userId">[] = [
  { weekday: 0, startTime: "05:30", endTime: "08:00", allowance: "any", label: null, sortOrder: 0 },
  { weekday: 0, startTime: "12:00", endTime: "14:00", allowance: "any", label: null, sortOrder: 1 },
  { weekday: 0, startTime: "20:00", endTime: "22:00", allowance: "admin_only", label: null, sortOrder: 2 },
  { weekday: 1, startTime: "05:30", endTime: "08:00", allowance: "deep_focus", label: null, sortOrder: 0 },
  { weekday: 1, startTime: "12:00", endTime: "14:30", allowance: "any", label: null, sortOrder: 1 },
  { weekday: 2, startTime: "05:30", endTime: "08:00", allowance: "any", label: null, sortOrder: 0 },
  { weekday: 2, startTime: "11:00", endTime: "14:00", allowance: "any", label: null, sortOrder: 1 },
  { weekday: 2, startTime: "20:00", endTime: "22:00", allowance: "admin_only", label: null, sortOrder: 2 },
  { weekday: 3, startTime: "06:00", endTime: "08:30", allowance: "deep_focus", label: null, sortOrder: 0 },
  { weekday: 3, startTime: "11:00", endTime: "15:00", allowance: "any", label: null, sortOrder: 1 },
  { weekday: 3, startTime: "20:00", endTime: "22:00", allowance: "admin_only", label: null, sortOrder: 2 },
  { weekday: 4, startTime: "05:30", endTime: "08:00", allowance: "any", label: null, sortOrder: 0 },
  { weekday: 4, startTime: "12:00", endTime: "14:00", allowance: "any", label: null, sortOrder: 1 },
  { weekday: 5, startTime: "07:00", endTime: "12:00", allowance: "deep_focus", label: null, sortOrder: 0 },
  { weekday: 6, startTime: "08:00", endTime: "11:00", allowance: "any", label: null, sortOrder: 0 },
  { weekday: 6, startTime: "19:00", endTime: "21:00", allowance: "no_work", label: null, sortOrder: 1 },
];

export const SEED_SETTINGS: SchedulerSettings = {
  userId: DEMO_USER_ID,
  deepFocusCap: 3,
  weekendUncapped: true,
  resetMinutes: 15,
  deepFocusMinutes: 45,
  standardMinutes: 30,
  gcalEventPrefix: "[ODY] ",
  theme: "light",
  defaultSort: "category",
};

interface SeedSpec {
  title: string;
  category: TaskCategory;
  location: TaskLocation;
  blocks: number;
  impact: number;
  /** Hours from now. Undefined means no due date. */
  dueInHours?: number;
  recurring?: boolean;
  assignee?: string;
  handedOff?: boolean;
  transcript?: string;
  source?: Task["captureSource"];
  notes?: string;
}

const SPECS: SeedSpec[] = [
  {
    title: "Payroll — Aug 16–31",
    category: "high_priority_admin",
    location: "home",
    blocks: 1,
    impact: 5,
    dueInHours: 9,
    source: "telegram_voice",
    transcript:
      "Hey, remind me I have to run payroll for the second half of August before Wednesday, that's the big one.",
  },
  {
    title: "Write SMHS volleyball block 3",
    category: "deep_focus",
    location: "home",
    blocks: 3,
    impact: 4,
    dueInHours: 52,
    notes: "Concentric block. Pull the force plate retest numbers first.",
  },
  {
    title: "Montana Western VB — week 2 upload",
    category: "deep_focus",
    location: "home",
    blocks: 2,
    impact: 4,
    dueInHours: 76,
  },
  {
    title: "Rent",
    category: "high_priority_admin",
    location: "home",
    blocks: 1,
    impact: 5,
    recurring: true,
    dueInHours: 30,
  },
  {
    title: "Mira Costa JUCO fall block",
    category: "deep_focus",
    location: "home",
    blocks: 2,
    impact: 3,
    dueInHours: 120,
  },
  {
    title: "Re-tape the platform edges",
    category: "low_priority_admin",
    location: "gym",
    blocks: 1,
    impact: 1,
  },
  {
    title: "Order chalk and bands",
    category: "low_priority_admin",
    location: "gym",
    blocks: 1,
    impact: 2,
    dueInHours: 96,
  },
  {
    title: "Sage Creek baseball invoice",
    category: "high_priority_admin",
    location: "home",
    blocks: 1,
    impact: 4,
    dueInHours: 44,
  },
  {
    title: "Fix the squat rack pin",
    category: "low_priority_admin",
    location: "gym",
    blocks: 1,
    impact: 2,
    dueInHours: 20,
  },
  {
    title: "Flight Academy roster confirmations",
    category: "high_priority_admin",
    location: "home",
    blocks: 1,
    impact: 3,
    dueInHours: 60,
  },
  {
    title: "Book the dentist",
    category: "personal",
    location: "home",
    blocks: 1,
    impact: 1,
  },
  {
    title: "Lift — upper, sprint dev after",
    category: "personal",
    location: "gym",
    blocks: 1,
    impact: 3,
    recurring: true,
  },
  {
    title: "Pull the new pricing sheet into the Doc",
    category: "high_priority_admin",
    location: "home",
    blocks: 2,
    impact: 5,
    dueInHours: 140,
  },
  {
    title: "Call back the Tri-City AD",
    category: "high_priority_admin",
    location: "home",
    blocks: 1,
    impact: 4,
    dueInHours: 34,
  },
  {
    title: "Chase the Boise State film request",
    category: "delegate",
    location: "home",
    blocks: 1,
    impact: 3,
    assignee: "Annie",
    dueInHours: 72,
  },
  {
    title: "Reschedule the Thursday 4pm trial",
    category: "delegate",
    location: "gym",
    blocks: 1,
    impact: 4,
    assignee: "Annie",
    dueInHours: 24,
  },
  {
    title: "Print the new team-rate sheet",
    category: "delegate",
    location: "gym",
    blocks: 1,
    impact: 2,
    assignee: "D'Lainey",
  },
  {
    title: "Walk the beginner group through the reset",
    category: "delegate",
    location: "gym",
    blocks: 1,
    impact: 3,
    assignee: "Jake",
    handedOff: true,
  },
  {
    title: "Cover the 6am Friday session",
    category: "delegate",
    location: "gym",
    blocks: 1,
    impact: 4,
    assignee: "Ty",
    dueInHours: 68,
  },
  {
    title: "Deep clean the turf",
    category: "delegate",
    location: "gym",
    blocks: 1,
    impact: 1,
  },
];

/**
 * Seed tasks positioned relative to `now`, so the demo always has a live
 * urgent item and a plausible spread of deadlines.
 */
export function seedTasks(now: Date): Task[] {
  return SPECS.map((spec, index) => ({
    id: `seed-${String(index + 1).padStart(4, "0")}`,
    userId: DEMO_USER_ID,
    title: spec.title,
    notes: spec.notes ?? null,
    category: spec.category,
    location: spec.location,
    estimatedBlocks: spec.blocks,
    actualBlocks: null,
    dueDate:
      spec.dueInHours === undefined
        ? null
        : new Date(now.getTime() + spec.dueInHours * 3_600_000).toISOString(),
    financialImpact: spec.impact,
    assignee: spec.assignee ?? null,
    handedOffAt: spec.handedOff ? new Date(now.getTime() - 3_600_000).toISOString() : null,
    status: "backlog" as const,
    isRecurring: spec.recurring ?? false,
    recurrenceRule: spec.recurring ? "FREQ=MONTHLY;BYMONTHDAY=1" : null,
    reminderLeadDays: 1,
    captureSource: spec.source ?? "manual",
    captureTranscript: spec.transcript ?? null,
    createdAt: new Date(now.getTime() - (index + 1) * 3_600_000).toISOString(),
    completedAt: null,
  }));
}

/**
 * Stand-in calendar walls for demo mode: a realistic coaching week, so the
 * scheduler has something to fill around and the location rule has something
 * to act on. Returns raw specs; the caller turns them into events.
 */
/**
 * The demo's recurring commitments — a realistic coaching week, so the
 * scheduler has walls to fill around with no setup at all. This replaces the
 * fixed week the stub calendar used to invent: same shape, but data the user
 * owns and can edit, which is the point of the screen.
 */
export const SEED_COMMITMENTS: Omit<Commitment, "id" | "userId">[] = [
  { title: "Youth S&C", weekday: 0, startTime: "08:30", endTime: "11:00", location: "gym", sortOrder: 0 },
  { title: "Afternoon sessions", weekday: 0, startTime: "15:00", endTime: "19:00", location: "gym", sortOrder: 1 },
  { title: "Elite group", weekday: 1, startTime: "08:30", endTime: "11:30", location: "gym", sortOrder: 0 },
  { title: "Afternoon sessions", weekday: 1, startTime: "15:00", endTime: "19:30", location: "gym", sortOrder: 1 },
  { title: "SMHS volleyball", weekday: 2, startTime: "06:00", endTime: "07:00", location: "gym", sortOrder: 0 },
  { title: "Afternoon sessions", weekday: 2, startTime: "14:30", endTime: "19:00", location: "gym", sortOrder: 1 },
  { title: "Mira Costa JUCO", weekday: 3, startTime: "09:00", endTime: "10:30", location: "gym", sortOrder: 0 },
  { title: "Sales meeting", weekday: 3, startTime: "14:00", endTime: "14:30", location: "home", sortOrder: 1 },
  { title: "Afternoon sessions", weekday: 3, startTime: "15:00", endTime: "19:00", location: "gym", sortOrder: 2 },
  { title: "Youth S&C", weekday: 4, startTime: "08:30", endTime: "11:00", location: "gym", sortOrder: 0 },
  { title: "Afternoon sessions", weekday: 4, startTime: "15:00", endTime: "18:00", location: "gym", sortOrder: 1 },
  { title: "Saturday open gym", weekday: 5, startTime: "09:00", endTime: "11:00", location: "gym", sortOrder: 0 },
];

/** True when the given instant falls inside a demo calendar wall. */
export function demoNowMinutes(now: Date, timeZone = DEFAULT_TIME_ZONE) {
  return { date: isoDate(now, timeZone), minutes: minutesOfDay(now, timeZone) };
}
