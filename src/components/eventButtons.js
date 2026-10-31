import { addVisualFeedbackToButtons } from '../utils/domUtils.js';
import { logger } from '../utils/formatUtils.js';
import { zoneForTeam } from '../utils/zoneUtils.js';
import { createButtonGrid } from './ui/grid.js';
import { rowGrids } from './config.js';
import { DEFAULT_TEAMS, getTeamColor, teamColorClass } from './teamPalette.js';

export class EventButtons {
    constructor(targetContainer) {
        this.targetContainer = targetContainer;
        this.config = null;
        this.teams = DEFAULT_TEAMS;
        this.zone = null;
        this.selectedTeam = 1;
    }

    setState(gameState) {
        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        const isRunning = gameState.isActive && gameState.isRunning;

        eventButtons.forEach(button => {
            button.disabled = !isRunning;
        });

        if (Array.isArray(gameState.loggedEvents)) {
            this.updateBadgeCounts(gameState.loggedEvents);
        }
    }

    /**
     * Updates badge counters on coding buttons without re-rendering the board
     * @param {Array} events - Logged events array
     */
    updateBadgeCounts(events = []) {
        const pcButtons = this.targetContainer.querySelectorAll(
            '.event-button[data-has-counter="true"], .event-button[data-event*="PC"], .event-button[data-base-event="PC"]'
        );
        pcButtons.forEach(button => {
            const badge = button.querySelector('[data-badge]') || button.querySelector('.event-counter-badge');
            if (!badge) return;

            const teamSlot = button.dataset.teamSlot;
            const team = teamSlot && this.teams ? this.teams[Number(teamSlot) - 1] : null;

            const count = events.filter(e => {
                if (!e) return false;
                const isPC =
                    e.eventCode === 'PC' ||
                    e.event === 'PC' ||
                    e.event === 'Penalty Corner' ||
                    (typeof e.event === 'string' && (e.event.endsWith('PC') || e.event.includes(' PC')));
                if (!isPC) return false;
                if (team) {
                    if (e.team) return e.team === team.code;
                    if (typeof e.event === 'string') return e.event.includes(team.code);
                }
                return true;
            }).length;

            if (typeof badge.setCount === 'function') {
                badge.setCount(count);
            } else {
                badge.textContent = String(count);
                if (count > 0) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        });
    }

    setConfig(config) {
        this.config = config;
    }

    /**
     * Render the board for a configuration
     * @param {Object} [config] - Board configuration; falls back to the last one set
     * @param {Object} [options]
     * @param {Array<{code: string, color: string}>} [options.teams] - Team 1 and Team 2 for team-slot rows
     * @param {string} [options.zone] - Active zone from Team 1's perspective
     * @param {number} [options.selectedTeam] - Team slot (1 or 2) picked on "selected" team rows
     */
    initialize(config, { teams, zone, selectedTeam } = {}) {
        // Use provided config, fall back to stored config, or log an error if neither exists
        const configToUse = config || this.config;
        if (!configToUse) {
            logger.error("No configuration available for event buttons initialization");
            return;
        }
        this.config = configToUse;
        if (Array.isArray(teams) && teams.length === 2) {
            this.teams = teams;
        }

        const zones = configToUse.zones;
        this.zone = zones ? (zones.values.includes(zone) ? zone : zones.default ?? zones.values[0]) : null;
        this.selectedTeam = selectedTeam === 2 ? 2 : 1;

        this.targetContainer.innerHTML = '';

        if (zones) {
            this.targetContainer.appendChild(this._renderZoneBar(zones));
        }

        const renderGroup = (group, rowIndex) => {
            const grids = rowGrids(group).filter(grid => Array.isArray(grid.buttons));
            if (grids.length === 0) {
                logger.warn("Skipping invalid group in config:", group);
                return; // Skip invalid groups
            }

            const groupContainer = document.createElement('div');
            groupContainer.className = 'group-container';

            const team = this._teamForRow(group);
            if (group.team === 'selected') {
                groupContainer.dataset.teamSelector = '';
                groupContainer.appendChild(this._renderTeamToggle());
            } else if (team) {
                groupContainer.dataset.teamSlot = String(team.slot);
                groupContainer.appendChild(this._renderTeamLabel(team));
            }

            const gridsContainer = document.createElement('div');
            gridsContainer.className = 'team-row-grids';
            grids.forEach((grid, gridIndex) => {
                // Use the createButtonGrid component from our UI library
                const gridEl = createButtonGrid({
                    gridCols: grid.gridCols || 'grid-cols-4', // Default if not specified
                    buttons: grid.buttons,
                    className: 'gap-2',
                    team
                });
                gridEl.dataset.rowIndex = String(rowIndex);
                gridEl.dataset.gridIndex = String(gridIndex);
                gridEl.querySelectorAll('.event-button[data-event]').forEach((btn, buttonIndex) => {
                    btn.dataset.rowIndex = String(rowIndex);
                    btn.dataset.gridIndex = String(gridIndex);
                    btn.dataset.buttonIndex = String(buttonIndex);
                });
                gridsContainer.appendChild(gridEl);
            });

            groupContainer.appendChild(gridsContainer);
            this.targetContainer.appendChild(groupContainer);
        };
        if (configToUse.rowDefs && Array.isArray(configToUse.rowDefs)) {
            configToUse.rowDefs.forEach(renderGroup);
        }

        this.targetContainer.querySelectorAll('.event-button[data-zoned]').forEach(button => {
            const tag = document.createElement('span');
            tag.className = 'zone-tag ml-1';
            tag.dataset.zoneTag = '';
            button.appendChild(tag);
        });
        this.setSelectedTeam(this.selectedTeam);
        if (zones) {
            this.setZone(this.zone);
        }

        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        addVisualFeedbackToButtons(eventButtons);
        this.setState({ isActive: false, isRunning: false, loggedEvents: [] });
    }

    /**
     * Show the active zone on the zone bar and on zoned buttons
     * @param {string} zone - Zone from Team 1's perspective
     */
    setZone(zone) {
        const zones = this.config?.zones;
        if (!zones || !zones.values.includes(zone)) return;
        this.zone = zone;

        const [team1, team2] = this.teams;
        const banner = this.targetContainer.querySelector('[data-zone-banner]');
        if (banner) {
            banner.textContent =
                `${team1.code} ZONE ${zone} · ${team2.code} ZONE ${zoneForTeam(zone, 2, zones)}`;
        }

        this.targetContainer.querySelectorAll('.zone-button[data-zone]').forEach(button => {
            const isActive = button.dataset.zone === zone;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        this.targetContainer.querySelectorAll('.event-button[data-zoned]').forEach(button => {
            const tag = button.querySelector('[data-zone-tag]');
            if (tag) tag.textContent = zoneForTeam(zone, button.dataset.teamSlot ?? 1, zones);
        });
    }

    /**
     * Pick the team that buttons on "selected" team rows log for
     * @param {number} slot - Team slot (1 or 2)
     */
    setSelectedTeam(slot) {
        if (slot !== 1 && slot !== 2) return;
        this.selectedTeam = slot;
        const team = this._teamForSlot(slot);

        this.targetContainer.querySelectorAll('[data-team-selector] .event-button[data-base-event]').forEach(button => {
            button.dataset.event = `${team.code} ${button.dataset.baseEvent}`;
            button.dataset.teamSlot = String(slot);
            if (button.dataset.teamColored) {
                this.teams.forEach(other => button.classList.remove(teamColorClass(other.color)));
                button.classList.add(team.colorClass);
            }
        });

        this.targetContainer.querySelectorAll('.team-toggle[data-team-select]').forEach(toggle => {
            const isActive = Number(toggle.dataset.teamSelect) === slot;
            const color = teamColorClass(this.teams[Number(toggle.dataset.teamSelect) - 1].color);
            toggle.classList.toggle('is-active', isActive);
            toggle.classList.toggle(color, isActive);
            toggle.setAttribute('aria-pressed', String(isActive));
        });

        if (this.config?.zones && this.zone) this.setZone(this.zone);
    }

    _teamForSlot(slot) {
        const team = this.teams[slot - 1];
        return { slot, code: team.code, color: team.color, colorClass: teamColorClass(team.color) };
    }

    _teamForRow(row) {
        if (row?.team === 'selected') return this._teamForSlot(this.selectedTeam);
        if (row?.team !== 1 && row?.team !== 2) return null;
        return this._teamForSlot(row.team);
    }

    _renderTeamToggle() {
        const header = document.createElement('div');
        header.className = 'team-toggle-bar';

        const label = document.createElement('span');
        label.className = 'team-row-label';
        label.textContent = 'TEAM';
        header.appendChild(label);

        this.teams.forEach((team, index) => {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'team-toggle';
            toggle.dataset.teamSelect = String(index + 1);
            toggle.textContent = team.code;
            toggle.setAttribute('aria-pressed', 'false');
            header.appendChild(toggle);
        });

        return header;
    }

    _renderTeamLabel(team) {
        const label = document.createElement('div');
        label.className = 'team-row-label';
        label.textContent = team.code;
        const color = getTeamColor(team.color);
        if (color) label.style.color = color.label;
        return label;
    }

    _renderZoneBar(zones) {
        const [team1, team2] = this.teams;
        const mirrored = (zones.perspective ?? 'mirrored') === 'mirrored';

        const bar = document.createElement('div');
        bar.className = 'zone-bar';

        const banner = document.createElement('div');
        banner.className = 'zone-banner';
        banner.dataset.zoneBanner = '';
        bar.appendChild(banner);

        const caption = document.createElement('div');
        caption.className = 'zone-caption';
        caption.textContent = mirrored
            ? `Zones from ${team1.code}'s perspective, ${team2.code} zones are mirrored`
            : 'Zones are fixed to the pitch';
        bar.appendChild(caption);

        const grid = document.createElement('div');
        grid.className = 'button-grid gap-2';
        grid.style.gridTemplateColumns = `repeat(${zones.values.length}, minmax(0, 1fr))`;
        zones.values.forEach(value => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'zone-button';
            button.dataset.zone = value;
            button.setAttribute('aria-pressed', 'false');

            const main = document.createElement('span');
            main.textContent = `ZONE ${value}`;
            button.appendChild(main);

            if (mirrored) {
                const mirror = document.createElement('span');
                mirror.className = 'zone-button-mirror';
                mirror.textContent = `${team2.code} ${zoneForTeam(value, 2, zones)}`;
                button.appendChild(mirror);
            }
            grid.appendChild(button);
        });
        bar.appendChild(grid);

        return bar;
    }
}
