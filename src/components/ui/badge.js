/**
 * Badge UI component
 * @module components/ui/badge
 */

const BADGE_HIGH_CONTRAST_CLASS = 'bg-amber-500 text-slate-950 font-bold';

/**
 * Creates a Badge element
 * @param {Object} [options]
 * @param {number|string} [options.count=0]
 * @param {string} [options.className='']
 * @param {boolean} [options.hidden=false]
 * @param {string} [options.id=null]
 * @param {string} [options.testId='badge']
 * @returns {HTMLSpanElement}
 */
export function createBadge({
    count = 0,
    className = '',
    hidden = false,
    id = null,
    testId = 'badge'
} = {}) {
    const badge = document.createElement('span');
    if (id) badge.id = id;
    badge.dataset.testid = testId;
    badge.dataset.badge = 'true';
    const isHidden = hidden || Number(count) === 0;
    badge.className = `event-counter-badge inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full shadow-sm ${BADGE_HIGH_CONTRAST_CLASS} ${className} ${isHidden ? 'hidden' : ''}`.trim();
    badge.textContent = String(count);

    badge.setCount = (newCount) => {
        badge.textContent = String(newCount);
        if (Number(newCount) > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    };

    return badge;
}


