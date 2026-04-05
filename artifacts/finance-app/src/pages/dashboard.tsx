import { format, subMonths } from "date-fns";
import { useMemo, useState } from "react";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useGetMonthlyTrend,
  useGetSpendingByCategory,
  useListTransactions
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Wallet, Activity, CreditCard } from "lucide-react";

export default function Dashboard() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ month: currentMonth });
  const { data: trend, isLoading: isLoadingTrend } = useGetMonthlyTrend();
  const { data: spending, isLoading: isLoadingSpending } = useGetSpendingByCategory({ month: currentMonth });
  const { data: transactions, isLoading: isLoadingTransactions } = useListTransactions({ limit: 5 });

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Here's your financial summary for {format(new Date(), "MMMM yyyy")}.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Balance" 
          value={summary?.totalBalance} 
          icon={Wallet} 
          isLoading={isLoadingSummary} 
        />
        <StatCard 
          title="Monthly Income" 
          value={summary?.monthlyIncome} 
          icon={ArrowUpRight} 
          isLoading={isLoadingSummary} 
          trend="positive"
        />
        <StatCard 
          title="Monthly Expenses" 
          value={summary?.monthlyExpenses} 
          icon={ArrowDownRight} 
          isLoading={isLoadingSummary} 
          trend="negative"
        />
        <StatCard 
          title="Net Savings" 
          value={summary?.netSavings} 
          icon={Activity} 
          isLoading={isLoadingSummary} 
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>Your cash flow over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTrend ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={(val) => format(new Date(val + "-01"), "MMM")} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Where your money went this month</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSpending ? (
              <Skeleton className="h-[300px] w-full" />
            ) : spending && spending.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spending}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="amount"
                    >
                      {spending.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.categoryColor || `hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                No spending data this month.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest financial activity</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: tx.categoryColor || 'hsl(var(--primary))' }}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.categoryName} • {tx.accountName} • {format(new Date(tx.date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className={`font-semibold ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : ''}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No recent transactions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isLoading, trend }: { title: string, value?: number, icon: any, isLoading: boolean, trend?: "positive" | "negative" }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={`text-2xl font-bold ${trend === 'positive' ? 'text-green-600 dark:text-green-400' : trend === 'negative' ? 'text-red-600 dark:text-red-400' : ''}`}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
