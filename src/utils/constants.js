export const ORIGIN_CONFIG = {
  polish:   { label: 'Poland',         demonym: 'Polish',         color: '#ef4444', badge: { background: '#dc143c', color: '#fff' } },
  czech:    { label: 'Czech Republic', demonym: 'Czech',          color: '#f97316', badge: { background: '#d7141a', color: '#fff', borderLeft: '4px solid #11457e' } },
  slovak:   { label: 'Slovakia',       demonym: 'Slovak',         color: '#8b5cf6', badge: { background: '#0b4ea2', color: '#fff', borderLeft: '4px solid #ee1c25' } },
  austrian: { label: 'Austria',        demonym: 'Austrian',       color: '#06b6d4', badge: { background: '#fff', color: '#ed2939', border: '1.5px solid #ed2939', borderLeftWidth: '4px', borderRightWidth: '4px' } },
  lebanese: { label: 'Lebanon',        demonym: 'Lebanese',       color: '#10b981', badge: { background: '#00a550', color: '#fff', borderLeft: '4px solid #f7192c' } },
  american: { label: 'America',        demonym: 'American',       color: '#3b82f6', badge: { background: '#3c3b6e', color: '#fff', borderLeft: '4px solid #b22234' } },
  german:   { label: 'Germany',        demonym: 'German',         color: '#eab308', badge: { background: '#dd0000', color: '#fff', borderTop: '3px solid #000', borderBottom: '3px solid #ffcc00' } },
  french:   { label: 'France',         demonym: 'French',         color: '#ec4899', badge: { background: '#fff', color: '#0055a4', borderLeft: '5px solid #0055a4', borderRight: '5px solid #ef4135', fontWeight: 700 } },
  swiss:    { label: 'Switzerland',    demonym: 'Swiss',          color: '#14b8a6', badge: { background: '#d52b1e', color: '#fff', border: '1.5px solid #d52b1e' } },
  irish:    { label: 'Ireland',        demonym: 'Irish',          color: '#22c55e', badge: { background: '#fff', color: '#0a5c36', borderLeft: '5px solid #169b62', borderRight: '5px solid #ff883e', fontWeight: 700 } },
  english:  { label: 'England',        demonym: 'English',        color: '#6366f1', badge: { background: '#012169', color: '#fff', borderBottom: '3px solid #C8102E' } },
  scottish: { label: 'Scotland',       demonym: 'Scottish',       color: '#0ea5e9', badge: { background: '#005EB8', color: '#fff', borderBottom: '3px solid #fff' } },
  italian:  { label: 'Italy',          demonym: 'Italian',        color: '#84cc16', badge: { background: '#009246', color: '#fff', borderRight: '6px solid #CE2B37' } },
  spanish:  { label: 'Spain',          demonym: 'Spanish',        color: '#f59e0b', badge: { background: '#AA151B', color: '#fff', borderTop: '3px solid #F1BF00', borderBottom: '3px solid #F1BF00' } },
  canadian: { label: 'Canada',         demonym: 'Canadian',       color: '#f43f5e', badge: { background: '#FF0000', color: '#fff' } },
  mexican:  { label: 'Mexico',         demonym: 'Mexican',        color: '#059669', badge: { background: '#006847', color: '#fff', borderRight: '6px solid #CE1126', borderBottom: '2px solid #C8992A' } },
  russian:  { label: 'Russia',         demonym: 'Russian',        color: '#4338ca', badge: { background: '#1C3578', color: '#fff', borderTop: '3px solid #fff', borderBottom: '3px solid #E4181C' } },
  ukrainian:{ label: 'Ukraine',        demonym: 'Ukrainian',      color: '#d946ef', badge: { background: '#0057B7', color: '#fff', borderBottom: '5px solid #FFD500' } },
  chinese:  { label: 'China',          demonym: 'Chinese',        color: '#b91c1c', badge: { background: '#EE1C25', color: '#FFFF00' } },
  syrian:   { label: 'Syria',          demonym: 'Syrian',         color: '#9333ea', badge: { background: '#ce1126', color: '#fff', borderTop: '3px solid #007a3d', borderBottom: '3px solid #000' } },
  hungarian:{ label: 'Hungary',        demonym: 'Hungarian',      color: '#16a34a', badge: { background: '#ce2939', color: '#fff', borderBottom: '3px solid #477050' } },
  turkish:  { label: 'Turkiye',        demonym: 'Turkish',        color: '#be123c', badge: { background: '#e30a17', color: '#fff', borderLeft: '4px solid #fff' } },
  rusyn:    { label: 'Carpatho-Rusyn', demonym: 'Carpatho-Rusyn', color: '#0033a0', badge: { background: '#0033a0', color: '#fff', borderBottom: '3px solid #d52b1e', borderLeft: '4px solid #fff' } },
  generic:  { label: 'Other',          demonym: 'Unknown',        color: '#94a3b8', badge: { background: '#8b8378', color: '#fff' } },
};

// Dynamically extract the labels and colors to keep the rest of your app seamlessly working
export const originLabels = Object.fromEntries(Object.entries(ORIGIN_CONFIG).map(([k, v]) => [k, v.label]));
export const originColors = Object.fromEntries(Object.entries(ORIGIN_CONFIG).map(([k, v]) => [k, v.color]));
export const originDemonyms = Object.fromEntries(Object.entries(ORIGIN_CONFIG).map(([k, v]) => [k, v.demonym]));