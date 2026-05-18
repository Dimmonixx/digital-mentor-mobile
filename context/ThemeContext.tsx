export const darkTheme = {
  bg: '#031427',
  bgSecondary: '#0a1628',
  bgCard: 'rgba(255,255,255,0.05)',
  accent: '#f2ca50',
  accentDim: 'rgba(242,202,80,0.2)',
  accentBorder: 'rgba(242,202,80,0.3)',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textDim: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,215,0,0.2)',
  error: '#ff4444',
  success: '#4CAF50',
  inputBg: 'rgba(255,255,255,0.05)',
  tabBar: '#031427',
  tabBorder: '#ffffff10',
};

export type Theme = typeof darkTheme;

export const useTheme = () => ({ theme: darkTheme });

import React from 'react';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
