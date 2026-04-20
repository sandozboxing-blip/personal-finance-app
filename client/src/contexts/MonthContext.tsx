import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface MonthContextValue {
  year: number;
  month: number;
  setMonth: (year: number, month: number) => void;
}

export const MonthContext = createContext<MonthContextValue>({
  year: 2026,
  month: 4,
  setMonth: () => {},
});

export function MonthProvider({ children }: { children: React.ReactNode }) {
  // Single atomic state to avoid two separate renders on month change
  const [{ year, month }, setState] = useState({ year: 2026, month: 4 });

  // Stable reference — never recreated, so context value only changes when year/month change
  const setMonth = useCallback((y: number, m: number) => {
    setState({ year: y, month: m });
  }, []);

  // Memoized value so consumers only re-render when year or month actually changes
  const value = useMemo(() => ({ year, month, setMonth }), [year, month, setMonth]);

  return (
    <MonthContext.Provider value={value}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  return useContext(MonthContext);
}
