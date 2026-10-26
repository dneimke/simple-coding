import fs from 'fs';
import path from 'path';

describe('Help View - User Guide & Tactical Workflows', () => {
    beforeEach(() => {
        const html = fs.readFileSync(path.resolve(__dirname, '../../src/index.html'), 'utf8');
        document.body.innerHTML = html;
    });

    test('renders updated guide header and sticky jump bar', () => {
        const pageTitle = document.querySelector('#help-view .page-title');
        expect(pageTitle).not.toBeNull();
        expect(pageTitle.textContent).toContain('User Guide & Tactical Workflows');

        const jumpBar = document.getElementById('help-jump-bar');
        expect(jumpBar).not.toBeNull();

        const jumpLinks = Array.from(jumpBar.querySelectorAll('a')).map(a => ({
            href: a.getAttribute('href'),
            text: a.textContent.trim()
        }));

        expect(jumpLinks).toEqual(expect.arrayContaining([
            expect.objectContaining({ href: '#help-overview-heading' }),
            expect.objectContaining({ href: '#help-configuration-title' }),
            expect.objectContaining({ href: '#help-sweep-metadata-title' })
        ]));
    });

    test('renders button board configuration section with lead/lag details and CTA', () => {
        const configHeading = document.getElementById('help-configuration-title');
        expect(configHeading).not.toBeNull();
        expect(configHeading.textContent).toContain('Board Configuration');

        const configSection = configHeading.closest('section');
        expect(configSection).not.toBeNull();

        // Check for lead / lag explanation
        expect(configSection.textContent).toMatch(/lead/i);
        expect(configSection.textContent).toMatch(/lag/i);

        // Check for CTA link to #configure
        const cta = configSection.querySelector('a[href="#configure"]');
        expect(cta).not.toBeNull();
        expect(cta.textContent).toMatch(/Configure|Customizer/i);
    });

    test('renders label sweep and AI metadata section with hotkeys and CTA', () => {
        const sweepHeading = document.getElementById('help-sweep-metadata-title');
        expect(sweepHeading).not.toBeNull();
        expect(sweepHeading.textContent).toMatch(/Label Sweep|AI Metadata/i);

        const sweepSection = sweepHeading.closest('section');
        expect(sweepSection).not.toBeNull();

        // Check for hotkeys and derivation explanation
        expect(sweepSection.textContent).toMatch(/1–3|1-3/);
        expect(sweepSection.textContent).toMatch(/Space/i);
        expect(sweepSection.textContent).toMatch(/Counter|Build-Up/i);

        // Check for CTA link to timeline-video.html
        const cta = sweepSection.querySelector('a[href*="timeline-video.html"]');
        expect(cta).not.toBeNull();
    });
});
