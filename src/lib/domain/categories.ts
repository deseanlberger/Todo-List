import type { TaskCategory } from "./types";

export interface CategoryMeta {
  id: TaskCategory;
  /** Uppercase label as it appears on cards and section headers. */
  label: string;
  /** Shortened form used in the Telegram spec line. */
  shortLabel: string;
  /** Minutes in one block. Null for delegate, which never schedules. */
  blockMinutes: number | null;
  schedules: boolean;
  /** 3px left rail — identical in both views. */
  rail: string;
  /** Label text colour, dark view. */
  labelDark: string;
  /** Label text colour, light view. */
  labelLight: string;
  /**
   * Category weight from SCHEDULER_RULES §7.4 — breaks ties at equal
   * due-proximity and equal financial impact. Higher wins.
   */
  weight: number;
}

/**
 * Fixed display order for the CATEGORY sort on All Tasks, and the tie-break
 * order for the scheduler.
 */
export const CATEGORY_ORDER: TaskCategory[] = [
  "deep_focus",
  "high_priority_admin",
  "low_priority_admin",
  "personal",
  "delegate",
];

export const CATEGORIES: Record<TaskCategory, CategoryMeta> = {
  deep_focus: {
    id: "deep_focus",
    label: "DEEP FOCUS",
    shortLabel: "DEEP FOCUS",
    blockMinutes: 45,
    schedules: true,
    rail: "#FFD700",
    labelDark: "#FFD700",
    labelLight: "#7A6100",
    weight: 4,
  },
  high_priority_admin: {
    id: "high_priority_admin",
    label: "HIGH PRIORITY ADMIN",
    shortLabel: "HI-PRI ADMIN",
    blockMinutes: 30,
    schedules: true,
    rail: "#C2453F",
    labelDark: "#C2453F",
    labelLight: "#A3352F",
    weight: 3,
  },
  low_priority_admin: {
    id: "low_priority_admin",
    label: "LOW PRIORITY ADMIN",
    shortLabel: "LO-PRI ADMIN",
    blockMinutes: 30,
    schedules: true,
    rail: "#6E7787",
    labelDark: "#6E7787",
    labelLight: "#4A5262",
    weight: 2,
  },
  personal: {
    id: "personal",
    label: "PERSONAL",
    shortLabel: "PERSONAL",
    blockMinutes: 30,
    schedules: true,
    rail: "#4E8C7D",
    labelDark: "#4E8C7D",
    labelLight: "#2F6A5C",
    weight: 1,
  },
  delegate: {
    id: "delegate",
    label: "DELEGATE",
    shortLabel: "DELEGATE",
    blockMinutes: null,
    schedules: false,
    rail: "#D3AF37",
    labelDark: "#D3AF37",
    labelLight: "#7A5F12",
    weight: 0,
  },
};

export function categoryMeta(category: TaskCategory): CategoryMeta {
  return CATEGORIES[category];
}

/**
 * Minutes in one block for a category. Delegate has no block size; callers
 * that reach here with a delegate task have a bug upstream.
 */
/**
 * §16 cold-start estimate: deep focus starts at 2 blocks, admin at 1.
 * What a task gets before any history exists to estimate from.
 */
export function defaultBlocks(category: TaskCategory): number {
  return category === "deep_focus" ? 2 : 1;
}

/**
 * How much calendar time a task needs, or null when it needs none.
 *
 * Delegate is the null case (§15): it is handed off in the delegation block,
 * never scheduled as itself. `blockMinutes` throws for it on purpose, so
 * anything that might be handed a delegate task asks here instead.
 */
export function taskMinutes(task: {
  category: TaskCategory;
  estimatedBlocks: number;
}): number | null {
  const minutes = CATEGORIES[task.category].blockMinutes;
  return minutes === null ? null : minutes * Math.max(1, task.estimatedBlocks);
}

export function blockMinutes(category: TaskCategory): number {
  const minutes = CATEGORIES[category].blockMinutes;
  if (minutes === null) {
    throw new Error(`Category "${category}" does not occupy calendar time`);
  }
  return minutes;
}
