import { logger } from '../utils/utils.js';

export class Router {
    constructor(views, tabs) {
        this.views = views;
        this.tabs = tabs;
    }

    switchTab = (tabToShow) => {
        const isTimelineView = tabToShow === 'timelineView';
        const isXmlView = tabToShow === 'xmlView';
        const isStatisticsView = tabToShow === 'statisticsView';

        const { timeline, xml, statistics, timelineView, xmlView, statisticsView } = this.tabs;

        timeline.classList.toggle('tab-button-active', isTimelineView);
        xml.classList.toggle('tab-button-active', isXmlView);
        statistics.classList.toggle('tab-button-active', isStatisticsView);

        timelineView.classList.toggle('hidden', !isTimelineView);
        xmlView.classList.toggle('hidden', !isXmlView);
        statisticsView.classList.toggle('hidden', !isStatisticsView);
    };

    showView = (viewToShow, callback) => {
        Object.values(this.views).forEach(({ view, button }) => {
            view.classList.add('hidden');
            button.classList.remove('text-white', 'hover:text-white');
            button.classList.add('text-gray-400', 'hover:text-white');
        });

        const selectedView = this.views[viewToShow];
        if (!selectedView) {
            logger.error(`Invalid view: ${viewToShow}`);
            return;
        }

        selectedView.view.classList.remove('hidden');
        selectedView.button.classList.add('text-white', 'hover:text-white');
        selectedView.button.classList.remove('text-gray-400', 'hover:text-white');

        if (typeof callback === 'function') {
            callback();
        }
    };
}