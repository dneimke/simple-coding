import fs from 'fs';
import path from 'path';

describe('Navigation Menu Consistency Across Screens', () => {
    const htmlFiles = [
        {
            file: 'src/index.html',
            matchesHref: '#saved-games',
            configHref: '#configure',
            helpHref: '#help',
            sequenceHref: 'spike/sequences/',
            sequenceCurrent: false
        },
        {
            file: 'src/timeline-video.html',
            matchesHref: 'index.html#saved-games',
            configHref: 'index.html#configure',
            helpHref: 'index.html#help',
            sequenceHref: 'spike/sequences/',
            sequenceCurrent: false
        },
        {
            file: 'src/spike/sequences/index.html',
            matchesHref: '../../index.html#saved-games',
            configHref: '../../index.html#configure',
            helpHref: '../../index.html#help',
            sequenceHref: './',
            sequenceCurrent: true
        }
    ];

    htmlFiles.forEach(({ file, matchesHref, configHref, helpHref, sequenceHref, sequenceCurrent }) => {
        describe(`in ${file}`, () => {
            let container;

            beforeEach(() => {
                const filePath = path.resolve(process.cwd(), file);
                const html = fs.readFileSync(filePath, 'utf8');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                container = doc;
            });

            test('main menu lists Configure, Help, then Sequence trial, with the brand opening Matches', () => {
                const navLinks = Array.from(container.querySelectorAll('#mainMenu .nav-link'));
                expect(navLinks).toHaveLength(3);

                const linkTexts = navLinks.map(el => el.querySelector('span')?.textContent.trim() || el.textContent.trim());
                expect(linkTexts).toEqual(['Configure', 'Help', 'Sequence trial']);

                expect(navLinks[0].getAttribute('href')).toBe(configHref);
                expect(navLinks[1].getAttribute('href')).toBe(helpHref);
                expect(navLinks[2].id).toBe('navSequences');
                expect(navLinks[2].getAttribute('href')).toBe(sequenceHref);
                expect(navLinks[2].querySelector('.fa-flask')).not.toBeNull();
                expect(navLinks[2].classList.contains('nav-link-active')).toBe(sequenceCurrent);
                expect(navLinks[2].getAttribute('aria-current')).toBe(sequenceCurrent ? 'page' : null);
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

    test('Matches subtitle keeps How the 3 modes work and leaves Sequence trial to the nav', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'src/index.html'), 'utf8');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const subtitle = doc.querySelector('#saved-games-view .page-subtitle');
        expect(subtitle).not.toBeNull();
        expect(subtitle.textContent).toContain('How the 3 modes work');
        expect(subtitle.textContent).not.toContain('Sequence trial');
        expect(subtitle.querySelector('a[href="spike/sequences/"]')).toBeNull();
    });
});
