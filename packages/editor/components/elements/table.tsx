import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import type { TableElementProps } from "../../types";

export function TableElement({ id, columns, rows }: TableElementProps) {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div id={id} className="text-center text-gray-500 p-6 border rounded-lg">
        Add table columns and rows in the settings
      </div>
    );
  }

  return (
    <div id={id} className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell key={index}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

