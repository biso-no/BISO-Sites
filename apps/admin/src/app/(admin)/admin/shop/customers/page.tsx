import { getOrders } from '@/app/actions/orders'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function CustomersPage() {
  const orders = await getOrders({ limit: 500 })

  const customersMap = new Map<string, { name: string; email: string; orders: number; total: number }>()
  for (const o of orders as any[]) {
    const email = (o.buyer_email || '').toLowerCase().trim()
    const name = o.buyer_name || 'Guest'
    const key = email || `guest-${name}`
    const prev = customersMap.get(key) || { name, email, orders: 0, total: 0 }
    customersMap.set(key, { name, email, orders: prev.orders + 1, total: prev.total + (o.total || 0) })
  }

  const customers = Array.from(customersMap.values()).sort((a, b) => b.total - a.total)

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Unique buyers aggregated from orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={(c.email || c.name) + c.orders} className="hover:bg-muted/50">
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email || '-'}</TableCell>
                  <TableCell className="text-right">{c.orders}</TableCell>
                  <TableCell className="text-right">{c.total.toFixed(2)} NOK</TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No customers yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


