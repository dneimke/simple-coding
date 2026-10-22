import fs from 'fs';
import path from 'path';

describe('Navigation Menu Consistency Across Screens', () => {
    const htmlFiles = [
        { file: 'src/index.html', matchesHref: '#saved-games', configHref: '#configure' },
        { file: 'src/timeline-video.html', matchesHref: 'index.html#saved-games', configHref: 'index.html#configure' }
    ];

    htmlFiles.forEach(({ file, matchesHref, configHref }) => {
        describe(`in ${file}`, () => {
            let container;

            beforeEach(() => {
                const filePath = path.resolve(process.cwd(), file);
                const html = fs.readFileSync(filePath, 'utf8');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                container = doc;
            });

            test('main menu contains exactly 2 main entry points: Matches and Configure', () => {
                const navLinks = Array.from(container.querySelectorAll('#mainMenu .nav-link'));
                expect(navLinks).toHaveLength(2);

                const linkTexts = navLinks.map(el => el.querySelector('span')?.textContent.trim() || el.textContent.trim());
                expect(linkTexts).toEqual(['Matches', 'Configure']);

                expect(navLinks[0].getAttribute('href')).toBe(matchesHref);
                expect(navLinks[1].getAttribute('href')).toBe(configHref);
            });

            test('does not contain "Event Capture" or "Saved Games" in main menu', () => {
                const navLinks = Array.from(container.querySelectorAll('#mainMenu .nav-link'));
                const linkTexts = navLinks.map(el => el.textContent);
                expect(linkTexts.some(t => t.includes('Event Capture'))).toBe(false);
                expect(linkTexts.some(t => t.includes('Saved Games'))).toBe(false);
            });

            test('mobile and desktop brand logos link to saved matches', () => {
                const brands = Array.from(container.querySelectorAll('.app-brand'));
                expect(brands.length).toBeGreaterThanOrEqual(2);

                brands.forEach(brand => {
                    expect(brand.tagName.toLowerCase()).toBe('a');
                    expect(brand.getAttribute('href')).toBe(matchesHref);
                });
            });
        });
    });
});
