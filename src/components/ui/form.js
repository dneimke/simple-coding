/**
 * Form UI components
 * @module components/ui/form
 */

/**
 * Creates a form input field
 *
 * @param {Object} options - Input configuration
 * @param {string} options.name - Input name attribute
 * @param {string} [options.id] - Input id attribute, defaults to name if not provided
 * @param {string} [options.type="text"] - Input type attribute
 * @param {string} [options.value=""] - Input initial value
 * @param {string} [options.placeholder=""] - Input placeholder text
 * @param {string} [options.label] - Label text (if provided, wraps input in label)
 * @param {boolean} [options.required=false] - Whether the field is required
 * @param {string} [options.className=""] - Additional CSS classes for the input
 * @param {Function} [options.onChange] - Change event handler
 * @returns {HTMLElement} Form input or form group element
 */
export const createInput = ({
    name,
    id = null,
    type = 'text',
    value = '',
    placeholder = '',
    label = null,
    required = false,
    className = '',
    onChange = null
}) => {
    // Create input element
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.id = id || name;
    input.value = value;
    input.placeholder = placeholder;

    // Apply Tailwind styles
    input.className = `block w-full px-3 py-2 border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`;

    if (required) {
        input.required = true;
    }

    // Add onChange handler if provided
    if (onChange) {
        input.addEventListener('change', onChange);
    }

    // If no label, just return the input
    if (!label) {
        return input;
    }

    // Create form group with label
    const formGroup = document.createElement('div');
    formGroup.className = 'mb-4';

    const labelElement = document.createElement('label');
    labelElement.htmlFor = input.id;
    labelElement.className = 'block text-sm font-medium text-gray-700 mb-1';
    labelElement.textContent = label;

    if (required) {
        const requiredSpan = document.createElement('span');
        requiredSpan.className = 'text-red-500 ml-1';
        requiredSpan.textContent = '*';
        labelElement.appendChild(requiredSpan);
    }

    formGroup.appendChild(labelElement);
    formGroup.appendChild(input);

    return formGroup;
};

/**
 * Creates a select dropdown field
 *
 * @param {Object} options - Select configuration
 * @param {string} options.name - Select name attribute
 * @param {string} [options.id] - Select id attribute, defaults to name if not provided
 * @param {Array<{value: string, text: string, selected?: boolean}>} options.options - Select options
 * @param {string} [options.label] - Label text
 * @param {boolean} [options.required=false] - Whether the field is required
 * @param {string} [options.className=""] - Additional CSS classes
 * @param {Function} [options.onChange] - Change event handler
 * @returns {HTMLElement} Select or form group element
 */
export const createSelect = ({
    name,
    id = null,
    options = [],
    label = null,
    required = false,
    className = '',
    onChange = null
}) => {
    // Create select element
    const select = document.createElement('select');
    select.name = name;
    select.id = id || name;

    // Apply Tailwind styles
    select.className = `block w-full px-3 py-2 border border-gray-300 rounded-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`;

    if (required) {
        select.required = true;
    }

    // Add options
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (opt.selected) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // Add onChange handler if provided
    if (onChange) {
        select.addEventListener('change', onChange);
    }

    // If no label, just return the select
    if (!label) {
        return select;
    }

    // Create form group with label
    const formGroup = document.createElement('div');
    formGroup.className = 'mb-4';

    const labelElement = document.createElement('label');
    labelElement.htmlFor = select.id;
    labelElement.className = 'block text-sm font-medium text-gray-700 mb-1';
    labelElement.textContent = label;

    if (required) {
        const requiredSpan = document.createElement('span');
        requiredSpan.className = 'text-red-500 ml-1';
        requiredSpan.textContent = '*';
        labelElement.appendChild(requiredSpan);
    }

    formGroup.appendChild(labelElement);
    formGroup.appendChild(select);

    return formGroup;
};

/**
 * Creates a form group for checkboxes or radio buttons
 *
 * @param {Object} options - Form group configuration
 * @param {string} options.legend - Group legend/title
 * @param {string} options.type - Input type ("checkbox" or "radio")
 * @param {string} options.name - Input name attribute
 * @param {Array<{value: string, label: string, checked?: boolean}>} options.items - Input items
 * @param {string} [options.className=""] - Additional CSS classes
 * @returns {HTMLFieldSetElement} Form group element
 */
export const createFormGroup = ({
    legend,
    type,
    name,
    items = [],
    className = ''
}) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = `mb-4 ${className}`;

    const legendElement = document.createElement('legend');
    legendElement.className = 'text-sm font-medium text-gray-700 mb-2';
    legendElement.textContent = legend;
    fieldset.appendChild(legendElement);

    items.forEach((item, index) => {
        const itemId = `${name}-${item.value}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center mb-1';

        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.id = itemId;
        input.value = item.value;
        input.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';

        if (item.checked) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = itemId;
        label.className = 'ml-2 text-sm text-gray-700';
        label.textContent = item.label;

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        fieldset.appendChild(wrapper);
    });

    return fieldset;
};
