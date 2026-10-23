import fs from 'fs';
import path from 'path';

describe('Help View — 3 Modes of Match Coding', () => {
    let doc;

    beforeEach(() => {
        const htmlPath = path.resolve(process.cwd(), 'src/index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        const parser = new DOMParser();
        doc = parser.parseFromString(html, 'text/html');
    });

    test('renders #help-view with clear headings for all 3 coding modes and Continue coding', () => {
        const helpView = doc.getElementById('help-view');
        expect(helpView).not.toBeNull();
        expect(helpView.classList.contains('hidden')).toBe(true);

        const text = helpView.textContent;
        expect(text).toContain('3 Modes of Match Coding');
        expect(text).toContain('1. Live Match');
        expect(text).toContain('2. From Video');
        expect(text).toContain('3. Import XML');
        expect(text).toContain('Continue Coding');
    });

    test('embeds screenshots from assets/help/ that exist on disk inside src/', () => {
        const helpView = doc.getElementById('help-view');
        const images = Array.from(helpView.querySelectorAll('img'));
        expect(images.length).toBeGreaterThanOrEqual(5);

        images.forEach((img) => {
            const src = img.getAttribute('src');
            expect(src).toMatch(/^assets\/help\/.+\.png$/);
            expect(img.getAttribute('alt')?.trim().length).toBeGreaterThan(10);

            const diskPath = path.resolve(process.cwd(), 'src', src);
            expect(fs.existsSync(diskPath)).toBe(true);
        });
    });

    test('includes direct action links to start coding or return to Matches', () => {
        const helpView = doc.getElementById('help-view');
        const hrefs = Array.from(helpView.querySelectorAll('a')).map((a) => a.getAttribute('href'));

        expect(hrefs).toContain('#saved-games');
        expect(hrefs).toContain('#event-capture');
        expect(hrefs).toContain('timeline-video.html?new=video');
        expect(hrefs).toContain('timeline-video.html?game=sample-game&mode=tag');
    });

    test('Matches Hub subtitle includes a quick link to #help', () => {
        const helpLink = doc.getElementById('matchesCodingModesHelpLink');
        expect(helpLink).not.toBeNull();
        expect(helpLink.getAttribute('href')).toBe('#help');
    });
});
