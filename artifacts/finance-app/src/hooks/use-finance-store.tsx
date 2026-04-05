import { createContext, useContext } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";

const FinanceStoreContext = createContext<ReturnType<typeof useFinanceData> | null>(null);

export function FinanceStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useFinanceData();
  return <FinanceStoreContext.Provider value={store}>{children}</FinanceStoreContext.Provider>;
}

export function useFinanceStore() {
  const ctx = useContext(FinanceStoreContext);
  if (!ctx) {
    throw new Error("useFinanceStore must be used inside FinanceStoreProvider");
  }
  return ctx;
}
