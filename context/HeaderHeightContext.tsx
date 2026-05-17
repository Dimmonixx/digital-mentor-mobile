import React, { createContext, useContext, useState } from 'react';

export const HeaderHeightContext = createContext(0);

export const HeaderHeightProvider = ({ children }: any) => {
  const [headerHeight, setHeaderHeight] = useState(0);
  return (
    <HeaderHeightContext.Provider value={headerHeight}>
      {children({ setHeaderHeight })}
    </HeaderHeightContext.Provider>
  );
};

export const useHeaderHeight = () => useContext(HeaderHeightContext);
