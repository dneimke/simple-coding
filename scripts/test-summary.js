// Writes a Markdown summary of a Jest run to $GITHUB_STEP_SUMMARY (or stdout when run locally).
// Usage: node scripts/test-summary.js [test-results.json] [coverage/coverage-summary.json]
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { relative } from 'node:path';

const [resultsPath = 'test-results.json', coveragePath = 'coverage/coverage-summary.json'] = process.argv.slice(2);
const MAX_FAILURES = 20;
const MAX_MESSAGE_LENGTH = 1500;

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

const dropInternalFrames = (text) => text
    .split('\n')
    .filter(line => !/^\s+at .*(node_modules|node:internal|<anonymous>)/.test(line))
    .join('\n');

const formatDuration = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

const resultsSection = (results) => {
    if (!results) {
        return [`> :warning: No Jest results found at \`${resultsPath}\`; the test run may not have started.`];
    }

    const passed = results.success;
    const endTime = Math.max(...results.testResults.map(suite => suite.endTime ?? results.startTime));
    const lines = [
        `${passed ? ':white_check_mark:' : ':x:'} **${passed ? 'All tests passed' : 'Tests failed'}** in ${formatDuration(endTime - results.startTime)}`,
        '',
        '| | Total | Passed | Failed | Skipped |',
        '| --- | ---: | ---: | ---: | ---: |',
        `| Suites | ${results.numTotalTestSuites} | ${results.numPassedTestSuites} | ${results.numFailedTestSuites} | ${results.numPendingTestSuites} |`,
        `| Tests | ${results.numTotalTests} | ${results.numPassedTests} | ${results.numFailedTests} | ${results.numPendingTests + results.numTodoTests} |`
    ];

    const failures = results.testResults.flatMap(suite => {
        const file = relative(process.cwd(), suite.name).replace(/\\/g, '/');
        const failedTests = suite.assertionResults
            .filter(test => test.status === 'failed')
            .map(test => ({ file, title: test.fullName, message: test.failureMessages.join('\n') }));
        // A suite can fail without any failed test, e.g. when the file throws on import
        return failedTests.length || suite.status !== 'failed'
            ? failedTests
            : [{ file, title: '(suite failed to run)', message: suite.message }];
    });

    if (failures.length) {
        lines.push('', '### Failures', '');
        failures.slice(0, MAX_FAILURES).forEach(({ file, title, message }) => {
            const detail = dropInternalFrames(stripAnsi(message ?? '')).trim().slice(0, MAX_MESSAGE_LENGTH);
            lines.push(`<details><summary><code>${file}</code> &rsaquo; ${title}</summary>`, '', '```', detail, '```', '', '</details>');
        });
        if (failures.length > MAX_FAILURES) {
            lines.push('', `…and ${failures.length - MAX_FAILURES} more; see the job log.`);
        }
    }

    return lines;
};

const coverageSection = (coverage) => {
    if (!coverage) return [];
    const metrics = ['statements', 'branches', 'functions', 'lines'];
    return [
        '',
        '### Coverage',
        '',
        `| ${metrics.map(metric => metric[0].toUpperCase() + metric.slice(1)).join(' | ')} |`,
        `| ${metrics.map(() => '---:').join(' | ')} |`,
        `| ${metrics.map(metric => `${coverage.total[metric].pct}%`).join(' | ')} |`
    ];
};

const markdown = [
    '## Unit test summary',
    '',
    ...resultsSection(readJson(resultsPath)),
    ...coverageSection(readJson(coveragePath)),
    ''
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
} else {
    process.stdout.write(markdown);
}
