import * as stylex from '@stylexjs/stylex';
import { colors } from '../colors.stylex';

export const lightTheme = stylex.createTheme(colors, {
  canvas: '#F5F5F2',
  sidebar: '#F0F1ED',
  surface: '#FFFFFF',
  surfaceAlt: '#EAEBE7',
  elevated: '#FFFFFF',
  hover: '#E4E6E1',
  border: '#D9DED8',
  borderStrong: '#8A968B',
  text: '#1B201F',
  secondary: '#4D5753',
  muted: '#626D67',
  inverse: '#FFFFFF',
  accent: '#805416',
  accentHover: '#6B4511',
  accentSubtle: '#F3E7D3',
  accentText: '#FFFFFF',
  success: '#267351',
  warning: '#805416',
  danger: '#B43C36',
  info: '#316A9F',
  overlay: 'rgba(0,0,0,0.55)',
  mediaText: '#FFFFFF',
  mediaScrim: 'rgba(0,0,0,0.55)',
});
