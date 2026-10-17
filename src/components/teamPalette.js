// Colours a team can pick when a game starts. Each id has a matching .team-color-<id> class in styles.css.
export const TEAM_PALETTE = [
    { id: 'red', name: 'Red', from: '#ef4444', to: '#dc2626', border: '#b91c1c', text: '#ffffff', label: '#dc2626' },
    { id: 'maroon', name: 'Maroon', from: '#9f1239', to: '#881337', border: '#4c0519', text: '#ffffff', label: '#881337' },
    { id: 'orange', name: 'Orange', from: '#f97316', to: '#ea580c', border: '#c2410c', text: '#ffffff', label: '#ea580c' },
    { id: 'yellow', name: 'Yellow', from: '#facc15', to: '#eab308', border: '#ca8a04', text: '#000000', label: '#ca8a04' },
    { id: 'green', name: 'Green', from: '#22c55e', to: '#16a34a', border: '#15803d', text: '#ffffff', label: '#16a34a' },
    { id: 'teal', name: 'Teal', from: '#14b8a6', to: '#0d9488', border: '#0f766e', text: '#ffffff', label: '#0d9488' },
    { id: 'sky', name: 'Sky blue', from: '#38bdf8', to: '#0ea5e9', border: '#0284c7', text: '#000000', label: '#0284c7' },
    { id: 'navy', name: 'Navy', from: '#1e40af', to: '#1e3a8a', border: '#172554', text: '#ffffff', label: '#1e3a8a' },
    { id: 'purple', name: 'Purple', from: '#a855f7', to: '#9333ea', border: '#7e22ce', text: '#ffffff', label: '#9333ea' },
    { id: 'black', name: 'Black', from: '#374151', to: '#111827', border: '#030712', text: '#ffffff', label: '#111827' }
];

export const DEFAULT_TEAMS = [
    { code: 'FIRE', color: 'red' },
    { code: 'TIGERS', color: 'yellow' }
];

export const getTeamColor = (id) => TEAM_PALETTE.find(color => color.id === id) ?? null;

export const teamColorClass = (id) => `team-color-${id}`;
