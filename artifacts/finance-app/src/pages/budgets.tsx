import { useListBudgets, useListCategories, useCreateBudget } from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

const formSchema = z.object({
  categoryId: z.coerce.number({ required_error: "Category is required" }),
  amount: z.coerce.number().positive("Amount must be positive"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM")
});

export default function Budgets() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: budgets, isLoading } = useListBudgets({ month: selectedMonth });
  const { data: categories } = useListCategories();
  
  const createMutation = useCreateBudget();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      month: currentMonth
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
        toast({ title: "Budget set successfully" });
      },
      onError: (err) => {
        toast({ title: "Error setting budget", variant: "destructive" });
      }
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground mt-1">Manage your spending limits.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Set Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Set Category Budget</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map(cat => (
                            <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Limit ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month (YYYY-MM)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Budget"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : budgets && budgets.length > 0 ? (
          budgets.map((budget, idx) => {
            const percentage = Math.min(100, Math.max(0, (budget.spent / budget.amount) * 100));
            const isOver = budget.spent > budget.amount;
            
            return (
              <Card key={budget.id} className="border-border/50 shadow-sm animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 100}ms` }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: budget.categoryColor || 'hsl(var(--primary))' }}
                      >
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{budget.categoryName}</h3>
                        <p className="text-sm text-muted-foreground">{formatCurrency(budget.spent)} spent of {formatCurrency(budget.amount)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-xl ${isOver ? 'text-destructive' : 'text-primary'}`}>
                        {formatCurrency(Math.abs(budget.remaining))} {isOver ? 'over' : 'left'}
                      </div>
                    </div>
                  </div>
                  
                  <Progress value={percentage} className={`h-2 ${isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`} />
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <PieChart className="w-6 h-6" />
              </div>
              <p className="font-medium text-lg">No budgets set</p>
              <p className="text-sm mt-1 mb-4">Set limits for your categories to track spending.</p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>Set First Budget</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
