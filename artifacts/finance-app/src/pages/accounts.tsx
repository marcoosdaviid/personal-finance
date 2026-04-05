import { useListAccounts, useCreateAccount } from "@workspace/api-client-react";
import { useState } from "react";
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
import { Plus, Wallet, Building2, Landmark, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["checking", "savings", "credit", "investment", "cash"]),
  balance: z.coerce.number(),
  currency: z.string().default("USD"),
  color: z.string().optional()
});

export default function Accounts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useListAccounts();
  const createMutation = useCreateAccount();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "checking",
      balance: 0,
      currency: "USD",
      color: "#2563eb"
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        toast({ title: "Account created successfully" });
      },
      onError: (err) => {
        toast({ title: "Error creating account", variant: "destructive" });
      }
    });
  };

  const formatCurrency = (val: number, currency: string = "USD") => 
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking': return <Wallet className="w-6 h-6" />;
      case 'savings': return <Building2 className="w-6 h-6" />;
      case 'credit': return <CreditCard className="w-6 h-6" />;
      case 'investment': return <Landmark className="w-6 h-6" />;
      case 'cash': return <Coins className="w-6 h-6" />;
      default: return <Wallet className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your connected financial accounts.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Checking" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="credit">Credit Card</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Balance</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </>
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account, idx) => (
            <Card key={account.id} className="border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="h-2 w-full" style={{ backgroundColor: account.color || 'hsl(var(--primary))' }} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white/90 shadow-inner"
                    style={{ backgroundColor: account.color || 'hsl(var(--primary))' }}
                  >
                    {getAccountIcon(account.type)}
                  </div>
                  <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md font-medium capitalize">
                    {account.type}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold truncate" title={account.name}>{account.name}</h3>
                  <p className="text-3xl font-bold mt-2 text-foreground">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card className="border-border/50 border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Wallet className="w-8 h-8" />
                </div>
                <p className="font-medium text-xl text-foreground">No accounts yet</p>
                <p className="text-sm mt-2 mb-6 max-w-sm">Add your first account to start tracking your finances and viewing your net worth.</p>
                <Button onClick={() => setIsDialogOpen(true)} size="lg" className="shadow-sm">Add First Account</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// Just for the fallback missing icon
function CreditCard(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  )
}
