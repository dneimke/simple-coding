import fs from 'fs';
import path from 'path';

describe('How It Works - Standalone Tour Page', () => {
    let html;

    beforeAll(() => {
        const filePath = path.resolve(__dirname, '../../src/how-it-works.html');
        html = fs.readFileSync(filePath, 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = html;
    });

    test('renders valid HTML structure with viewport and styling links', () => {
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('name="viewport"');
        expect(html).toContain('styles.css');
        expect(html).toContain('Field Hockey Match Tracker &amp; Video Review');
    });

    test('renders primary navigation back to main application', () => {
        const navLinks = Array.from(document.querySelectorAll('a[href="index.html#saved-games"]'));
        expect(navLinks.length).toBeGreaterThan(0);

        const openAppBtn = navLinks.find(a => a.textContent.includes('Open App'));
        expect(openAppBtn).toBeDefined();

        const brandLink = navLinks.find(a => a.textContent.includes('simple-coding'));
        expect(brandLink).toBeDefined();
    });

    test('renders the 3 operational headache solutions', () => {
        const headachesHeading = document.getElementById('headaches-heading');
        expect(headachesHeading).not.toBeNull();
        expect(headachesHeading.textContent).toContain('Three Match-Day Headaches');

        const modeBtnNew = document.getElementById('btn-mode-new');
        const modeBtnOld = document.getElementById('btn-mode-old');
        expect(modeBtnNew).not.toBeNull();
        expect(modeBtnOld).not.toBeNull();

        // Check cards
        expect(document.getElementById('title-1')).not.toBeNull();
        expect(document.getElementById('title-2')).not.toBeNull();
        expect(document.getElementById('title-3')).not.toBeNull();
    });

    test('renders the 4-step workflow stepper with interactive tabs', () => {
        const tab0 = document.getElementById('step-tab-0');
        const tab1 = document.getElementById('step-tab-1');
        const tab2 = document.getElementById('step-tab-2');
        const tab3 = document.getElementById('step-tab-3');

        expect(tab0).not.toBeNull();
        expect(tab1).not.toBeNull();
        expect(tab2).not.toBeNull();
        expect(tab3).not.toBeNull();

        const stepVisual = document.getElementById('step-visual');
        expect(stepVisual).not.toBeNull();
    });

    test('renders all four sideline personas', () => {
        const text = document.body.textContent;
        expect(text).toContain('The Sideline Volunteer');
        expect(text).toContain('The Bench Coach');
        expect(text).toContain('The Head Coach');
        expect(text).toContain('The Dedicated Analyst');
    });

    test('contains zero developer/implementation jargon in visible copy', () => {
        const bodyText = document.body.textContent;
        const bannedJargon = [
            'localStorage',
            'IndexedDB',
            'schema',
            'factory default',
            'JSON.parse',
            'DOM element'
        ];

        bannedJargon.forEach(term => {
            expect(bodyText).not.toContain(term);
        });
    });

    test('index.html help view contains a link to the shareable how-it-works page', () => {
        const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../src/index.html'), 'utf8');
        expect(indexHtml).toContain('href="how-it-works.html"');
        expect(indexHtml).toContain('Shareable Match Day Tour');
    });
});
