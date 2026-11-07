/**
 * Shared wording for the sequence trial page and the command-line report.
 */

export function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function entryTitle(entry) {
    const clock = entry.quarter
        ? `${entry.quarter} ${entry.matchClock}`
        : `match ${entry.matchClock}`;
    return `${entry.originType} · ${clock} (video ${entry.videoTime})`;
}

export function entryCodes(entry) {
    return entry.events.map(event => `${formatClock(event.timeMs)} ${event.code}`).join(' → ');
}

export function entryDetail(entry) {
    return `${entry.reason} · Seek ${formatClock(entry.seekSeconds * 1000)}`;
}

export function splitSummaryText(label, counts) {
    return `${label}: ${counts.total} total — ${counts.counter} Counter, ${counts.buildUp} Build-Up.`;
}
