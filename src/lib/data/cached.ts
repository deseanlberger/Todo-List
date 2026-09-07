import "server-only";
import { cache } from "react";
import { repository } from "./index";

/**
 * Reads that more than one part of a single page wants.
 *
 * `cache` memoizes for the lifetime of one request, so the layout and the
 * page it wraps share a single query instead of each making their own. Two
 * places asking for the settings is a legitimate thing to do; two round
 * trips to Oregon for the same row is not.
 *
 * Only for reads. A server action that has just written must call the
 * repository directly, or it would be handed the value from before the write.
 */
export const getSettingsCached = cache(() => repository().getSettings());

export const listTasksCached = cache(() => repository().listTasks());
