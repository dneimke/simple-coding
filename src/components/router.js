import { logger } from '../utils/utils.js';

export class Router {
    constructor(views, tabs) {
        this.views = views;
        this.tabs = tabs;
    }

    switchTab = (tabToShow) => {
        const isTimelineView = tabToShow === 'timelineView';
        const { timeline, xml, timelineView, xmlView } = this.tabs;

        timeline.classList.toggle('tab-button-active', isTimelineView);
        xml.classList.toggle('tab-button-active', !isTimelineView);
        timeline.classList.toggle('tab-button', !isTimelineView);
        xml.classList.toggle('tab-button', isTimelineView);

        timelineView.classList.toggle('hidden', !isTimelineView);
        xmlView.classList.toggle('hidden', isTimelineView);
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