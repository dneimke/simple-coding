import fs from 'fs';
import path from 'path';

describe('Navigation Menu Consistency Across Screens', () => {
    const htmlFiles = [
        { file: 'src/index.html', matchesHref: '#saved-games', configHref: '#configure', helpHref: '#help' },
        { file: 'src/timeline-video.html', matchesHref: 'index.html#saved-games', configHref: 'index.html#configure', helpHref: 'index.html#help' }
    ];

    htmlFiles.forEach(({ file, matchesHref, configHref, helpHref }) => {
        describe(`in ${file}`, () => {
            let container;

            beforeEach(() => {
                const filePath = path.resolve(process.cwd(), file);
                const html = fs.readFileSync(filePath, 'utf8');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                container = doc;
            });

            test('main menu contains Configure and Help entry points with brand acting as Home/Matches link', () => {
                const navLinks = Array.from(container.querySelectorAll('#mainMenu .nav-link'));
                expect(navLinks).toHaveLength(2);

                const linkTexts = navLinks.map(el => el.querySelector('span')?.textContent.trim() || el.textContent.trim());
                expect(linkTexts).toEqual(['Configure', 'Help']);

                expect(navLinks[0].getAttribute('href')).toBe(configHref);
                expect(navLinks[1].getAttribute('href')).toBe(helpHref);
            });

            test('does not contain "Event Capture", "Saved Games", or redundant "Matches" link in main menu', () => {
                const navLinks = Array.from(container.querySelectorAll('#mainMenu .nav-link'));
                const linkTexts = navLinks.map(el => el.textContent);
                expect(linkTexts.some(t => t.includes('Event Capture'))).toBe(false);
                expect(linkTexts.some(t => t.includes('Saved Games'))).toBe(false);
                expect(linkTexts.some(t => t.includes('Matches'))).toBe(false);
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
