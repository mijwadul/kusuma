import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Division = 'alat-berat' | 'hauling' | 'material' | 'corporate' | null;

interface DivisionContextType {
  activeDivision: Division;
  setActiveDivision: (division: Division) => void;
}

const DivisionContext = createContext<DivisionContextType | undefined>(undefined);

export const DivisionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeDivision, setActiveDivisionState] = useState<Division>(() => {
    const saved = localStorage.getItem('activeDivision');
    return (saved as Division) || null;
  });

  const setActiveDivision = (division: Division) => {
    setActiveDivisionState(division);
    if (division) {
      localStorage.setItem('activeDivision', division);
    } else {
      localStorage.removeItem('activeDivision');
    }
  };

  return (
    <DivisionContext.Provider value={{ activeDivision, setActiveDivision }}>
      {children}
    </DivisionContext.Provider>
  );
};

export const useDivision = () => {
  const context = useContext(DivisionContext);
  if (context === undefined) {
    throw new Error('useDivision must be used within a DivisionProvider');
  }
  return context;
};
