import { logger } from '../utils/formatUtils.js';
import { stateService } from '../services/stateService.js';

export class Router {
    constructor(views, tabs) {
        this.views = views;
        this.tabs = tabs;

        // Subscribe to UI state changes
        stateService.subscribe('ui.currentTab', this._handleTabChange.bind(this));
        stateService.subscribe('ui.currentView', this._handleViewChange.bind(this));
    }

    /**
     * Handle tab change from state service
     * @param {string} tabName - New tab name
     * @private
     */
    _handleTabChange = (tabName) => {
        const isTimelineView = tabName === 'timelineView';
        const isXmlView = tabName === 'xmlView';
        const isStatisticsView = tabName === 'statisticsView';

        const { timeline, xml, statistics, timelineView, xmlView, statisticsView } = this.tabs;

        timeline.classList.toggle('tab-button-active', isTimelineView);
        xml.classList.toggle('tab-button-active', isXmlView);
        statistics.classList.toggle('tab-button-active', isStatisticsView);

        timelineView.classList.toggle('hidden', !isTimelineView);
        xmlView.classList.toggle('hidden', !isXmlView);
        statisticsView.classList.toggle('hidden', !isStatisticsView);
    };

    switchTab = (tabToShow) => {
        stateService.setState('ui.currentTab', tabToShow);
    };    /**
     * Handle view change from state service
     * @param {string} viewName - New view name
     * @private
     */
    _handleViewChange = (viewName) => {
        Object.values(this.views).forEach(({ view, button }) => {
            view.classList.add('hidden');
            button.classList.remove('text-white', 'hover:text-white');
            button.classList.add('text-gray-400', 'hover:text-white');
        });

        const selectedView = this.views[viewName];
        if (!selectedView) {
            logger.error(`Invalid view: ${viewName}`);
            return;
        }

        selectedView.view.classList.remove('hidden');
        selectedView.button.classList.add('text-white', 'hover:text-white');
        selectedView.button.classList.remove('text-gray-400', 'hover:text-white');
    };

    showView = (viewToShow, callback) => {
        stateService.setState('ui.currentView', viewToShow);

        if (typeof callback === 'function') {
            callback();
        }
    };
}