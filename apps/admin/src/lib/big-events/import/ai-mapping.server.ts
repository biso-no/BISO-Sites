import "server-only";

import { fastModel } from "@repo/ai/models";
import { traceAiCall } from "@repo/observability/ai";
import { generateObject } from "ai";
import { z } from "zod";
import { IMPORT_FIELDS, type ImportField } from "./field-aliases";

export interface ColumnToSuggest {
  header: string;
  index: number;
  shape: string;
}

const suggestionSchema = z.object({
  columns: z.array(
    z.object({
      field: z.enum(IMPORT_FIELDS),
      index: z.number().int(),
    })
  ),
});

const INSTRUCTIONS = `A student organisation imported a participant spreadsheet. For each column below, decide what it holds.
You only see the column header and the general shape of its values, never the values themselves.

Fields:
- first_name: the person's given name
- last_name: the person's family name
- full_name: first and last name in one column
- email: an email address
- phone: a phone number
- campus: the campus city the person belongs to
- ticket_ref: an order or ticket reference number
- ticket_category: the ticket type text, often containing a campus city and a room size like 4-Person
- group: a room, bus, buddy group or team the person belongs to
- ignore: anything else

Answer "ignore" when unsure. Return one entry per column, using the column's index.`;

export const suggestColumnsWithAi = async (
  columns: ColumnToSuggest[]
): Promise<Record<number, ImportField>> => {
  if (columns.length === 0) {
    return {};
  }
  const lines = columns.map(
    ({ index, header, shape }) =>
      `${index}: header=${JSON.stringify(header)} shape=${JSON.stringify(shape)}`
  );
  try {
    const { object } = await traceAiCall(
      {
        functionId: "admin.big-events.column-mapping",
        model: fastModel,
        operation: "generate_object",
      },
      () =>
        generateObject({
          model: fastModel,
          reasoning: "low",
          prompt: `${INSTRUCTIONS}\n\nColumns:\n${lines.join("\n")}`,
          schema: suggestionSchema,
        })
    );
    const known = new Set(columns.map((column) => column.index));
    const result: Record<number, ImportField> = {};
    for (const { index, field } of object.columns) {
      if (known.has(index)) {
        result[index] = field;
      }
    }
    return result;
  } catch {
    return {};
  }
};
