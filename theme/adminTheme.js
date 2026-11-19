// Colors for the Admin Dashboard only.
// The Member side is dark; the Admin side is a light "workspace" with a dark
// sidebar, so the two never look alike. The maroon is kept so it is still GymFit.
export const ADMIN = {
  bg: '#F3F4F6', // page background
  surface: '#FFFFFF', // cards and tables
  surfaceAlt: '#F9FAFB', // table headers, hover rows
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#5B6472', // 5:1 or better on white and on the page background
  brand: '#8B0000', // buttons, active tab underline
  brandSoft: '#FBEAEA',
  onBrand: '#FFFFFF',

  sidebar: '#12141A',
  sidebarActive: '#2A171A',
  sidebarBorder: '#262A33',
  sidebarText: '#D7DAE1',
  sidebarMuted: '#8F96A3',
  sidebarAccent: '#F08080', // active item icon / marker
};

// Status colors: a dark text color on a light tint of the same hue.
export const TONES = {
  success: { fg: '#166534', bg: '#DCFCE7', bar: '#16A34A' },
  warning: { fg: '#92400E', bg: '#FEF3C7', bar: '#D97706' },
  danger: { fg: '#991B1B', bg: '#FEE2E2', bar: '#DC2626' },
  info: { fg: '#1E40AF', bg: '#DBEAFE', bar: '#2563EB' },
  neutral: { fg: '#374151', bg: '#E5E7EB', bar: '#6B7280' },
  brand: { fg: '#8B0000', bg: '#FBEAEA', bar: '#8B0000' },
};

export default ADMIN;
