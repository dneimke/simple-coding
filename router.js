import { logger } from './utils.js';

export class Router {
    constructor(views, tabs) {
        this.views = views;
        this.tabs = tabs;
    }

    switchTab = (tabToShow) => {
        const isListView = tabToShow === 'listView';
        const { list, xml, listView, xmlView } = this.tabs;

        list.classList.toggle('tab-button-active', isListView);
        xml.classList.toggle('tab-button-active', !isListView);
        list.classList.toggle('tab-button', !isListView);
        xml.classList.toggle('tab-button', isListView);

        listView.classList.toggle('hidden', !isListView);
        xmlView.classList.toggle('hidden', isListView);
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