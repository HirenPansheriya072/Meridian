/**
 * Interval set algebra over UTC instants, expressed as { start, end } in epoch ms.
 *
 * Availability is fundamentally a set operation: take the union of when someone
 * works, subtract when they are busy, intersect across people for a group call.
 * Keeping that algebra in one small tested file is what stops the scheduling
 * engine turning into a nest of date comparisons.
 *
 * Convention throughout: intervals are half-open, [start, end). Two intervals that
 * merely touch at an endpoint do not overlap -- a 9:00-9:30 call and a 9:30-10:00
 * call are back to back, not a conflict.
 */

function normalise(intervals) {
  return intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
}

/** Union. Overlapping and touching intervals collapse into one. */
function merge(intervals) {
  const sorted = normalise(intervals);
  const out = [];

  for (const interval of sorted) {
    const last = out[out.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      out.push({ ...interval });
    }
  }
  return out;
}

/** a minus b. Used to carve existing bookings out of working hours. */
function subtract(a, b) {
  const blockers = merge(b);
  let out = normalise(a).map((i) => ({ ...i }));

  for (const blocker of blockers) {
    const next = [];
    for (const interval of out) {
      // No overlap: keep whole.
      if (blocker.end <= interval.start || blocker.start >= interval.end) {
        next.push(interval);
        continue;
      }
      // Left remainder.
      if (blocker.start > interval.start) {
        next.push({ ...interval, start: interval.start, end: blocker.start });
      }
      // Right remainder.
      if (blocker.end < interval.end) {
        next.push({ ...interval, start: blocker.end, end: interval.end });
      }
      // Fully covered: contributes nothing.
    }
    out = next;
  }

  return normalise(out);
}

/** Intersection of two sets. The building block of collective availability. */
function intersect(a, b) {
  const left = merge(a);
  const right = merge(b);
  const out = [];

  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (end > start) out.push({ start, end });

    // Advance whichever interval ends first.
    if (left[i].end < right[j].end) i += 1;
    else j += 1;
  }

  return out;
}

/** Intersection across many sets. Empty input means "nobody is free". */
function intersectAll(sets) {
  if (sets.length === 0) return [];
  return sets.reduce((acc, set) => intersect(acc, set), merge(sets[0]));
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function contains(outer, inner) {
  return inner.start >= outer.start && inner.end <= outer.end;
}

function totalMinutes(intervals) {
  return merge(intervals).reduce((sum, i) => sum + (i.end - i.start), 0) / 60000;
}

module.exports = { merge, subtract, intersect, intersectAll, overlaps, contains, totalMinutes, normalise };
