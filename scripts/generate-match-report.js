#!/usr/bin/env node

/**
 * CLI tool to generate an interactive match analytics HTML dossier from a Sportscode XML file.
 * Usage: node scripts/generate-match-report.js <path-to-xml> [output-html-path]
 */

import fs from 'fs';
import path from 'path';
import { buildMatchReportFromXml } from '../src/utils/matchReportGenerator.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage:
  npm run report -- <path-to-xml> [output-html-path]
  node scripts/generate-match-report.js <path-to-xml> [output-html-path]

Examples:
  npm run report -- h1w-20261107-thunder-v-blaze-converted.xml
  npm run report -- path/to/game.xml reports/custom-report.html
`);
    process.exit(0);
}

const inputPath = path.resolve(process.cwd(), args[0]);

if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
}

const baseName = path.basename(inputPath, path.extname(inputPath));
const defaultOutDir = path.resolve(process.cwd(), 'reports');
if (!fs.existsSync(defaultOutDir)) {
    fs.mkdirSync(defaultOutDir, { recursive: true });
}

const outputPath = args[1]
    ? path.resolve(process.cwd(), args[1])
    : path.join(defaultOutDir, `${baseName}-report.html`);

try {
    const xmlContent = fs.readFileSync(inputPath, 'utf8');
    const { data, html } = buildMatchReportFromXml(xmlContent, { title: baseName });

    fs.writeFileSync(outputPath, html, 'utf8');

    console.log(`
============================================================
  HOCKEY MATCH REPORT GENERATED
============================================================
  Fixture:     ${data.title}
  Result:      ${data.teams[0]} ${data.score.team1} - ${data.score.team2} ${data.teams[1]}
  Total Events: ${data.totalEvents}
  Duration:    ${Math.floor(data.durationSeconds / 60)}m ${Math.floor(data.durationSeconds % 60)}s

  KPI Summary:
  - Shots:     ${data.teams[0]} ${data.kpis.team1.SHOT} | ${data.teams[1]} ${data.kpis.team2.SHOT}
  - PCs:       ${data.teams[0]} ${data.kpis.team1.PC} | ${data.teams[1]} ${data.kpis.team2.PC}
  - CEs:       ${data.teams[0]} ${data.kpis.team1.CE} | ${data.teams[1]} ${data.kpis.team2.CE}
  - Cards:     ${data.teams[0]} ${data.kpis.team1.CARD} | ${data.teams[1]} ${data.kpis.team2.CARD}

  Output Saved:
  -> ${outputPath}
============================================================
`);
} catch (err) {
    console.error('Failed to generate match report:', err);
    process.exit(1);
}
