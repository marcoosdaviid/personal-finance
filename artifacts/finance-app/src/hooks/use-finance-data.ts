import { useEffect, useMemo, useState } from "react";
import { FinanceData, emptyFinanceData, loadFinanceData, saveFinanceData } from "@/lib/finance";

export function useFinanceData() {
  const [data, setData] = useState<FinanceData>(emptyFinanceData);

  useEffect(() => {
    setData(loadFinanceData());
  }, []);

  useEffect(() => {
    saveFinanceData(data);
  }, [data]);

  return useMemo(
    () => ({
      data,
      setData,
    }),
    [data],
  );
}
