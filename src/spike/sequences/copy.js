/**
 * Shared wording for the sequence trial page and the command-line report.
 */

export function formatClock(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function sequenceTitle(sequence) {
    const clock = sequence.quarter
        ? `${sequence.quarter} ${sequence.matchClockStart}`
        : `match ${sequence.matchClockStart}`;
    return [
        `${sequence.videoStart}–${sequence.videoEnd}`,
        clock,
        sequence.originType || 'origin not coded',
        sequence.primaryChannel || 'channel not coded'
    ].join(' · ');
}

export function sequenceCodes(sequence) {
    return sequence.events.map(event => `${formatClock(event.timeMs)} ${event.code}`).join(' → ');
}

export function sequenceCloseNote(sequence) {
    if (sequence.closedBecause === 'opponent-bw') return 'Closed when the other team won the ball.';
    if (sequence.closedBecause === 'goal') return 'Ends at the goal.';
    if (sequence.closedBecause === 'gap') return `No same-team tag for ${sequence.gapSeconds}s.`;
    return '';
}
