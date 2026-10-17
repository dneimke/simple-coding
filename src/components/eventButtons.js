import { addVisualFeedbackToButtons } from '../utils/domUtils.js';
import { logger } from '../utils/formatUtils.js';
import { zoneForTeam } from '../utils/zoneUtils.js';
import { createButtonGrid } from './ui/index.js';
import { rowGrids } from './config.js';
import { DEFAULT_TEAMS, getTeamColor, teamColorClass } from './teamPalette.js';

export class EventButtons {
    constructor(targetContainer) {
        this.targetContainer = targetContainer;
        this.config = null;
        this.teams = DEFAULT_TEAMS;
        this.zone = null;
    }

    setState(gameState) {
        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        const isRunning = gameState.isActive && gameState.isRunning;

        eventButtons.forEach(button => {
            button.disabled = !isRunning;
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
     */
    initialize(config, { teams, zone } = {}) {
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

        this.targetContainer.innerHTML = '';

        if (zones) {
            this.targetContainer.appendChild(this._renderZoneBar(zones));
        }

        const renderGroup = (group) => {
            const grids = rowGrids(group).filter(grid => Array.isArray(grid.buttons));
            if (grids.length === 0) {
                logger.warn("Skipping invalid group in config:", group);
                return; // Skip invalid groups
            }

            const groupContainer = document.createElement('div');
            groupContainer.className = 'group-container';

            const team = this._teamForRow(group);
            if (team) {
                groupContainer.dataset.teamSlot = String(team.slot);
                groupContainer.appendChild(this._renderTeamLabel(team));
            }

            const gridsContainer = document.createElement('div');
            gridsContainer.className = 'team-row-grids';
            grids.forEach(grid => {
                // Use the createButtonGrid component from our UI library
                gridsContainer.appendChild(createButtonGrid({
                    gridCols: grid.gridCols || 'grid-cols-4', // Default if not specified
                    buttons: grid.buttons,
                    className: 'gap-2',
                    team
                }));
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
        if (zones) {
            this.setZone(this.zone);
        }

        const eventButtons = this.targetContainer.querySelectorAll('.event-button[data-event]');
        addVisualFeedbackToButtons(eventButtons);
        this.setState({ isActive: false, isRunning: false });
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

    _teamForRow(row) {
        if (row?.team !== 1 && row?.team !== 2) return null;
        const team = this.teams[row.team - 1];
        return { slot: row.team, code: team.code, color: team.color, colorClass: teamColorClass(team.color) };
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
