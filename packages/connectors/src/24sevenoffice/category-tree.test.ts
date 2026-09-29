import { expect, mock, test } from "bun:test";

const GetCustomerCategoryTreeAsync = mock(async () => [
  {
    GetCustomerCategoryTreeResult: {
      KeyValuePair: [
        { Key: "10", Value: "3975" },
        { Key: "x", Value: "1" },
      ],
    },
  },
]);

mock.module("./auth", () => ({
  getValidSession: async () => "session-token",
}));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({ GetCustomerCategoryTreeAsync }),
}));

const { getCustomerCategoryTree } = await import("./categories");

test("passes a per-call timeout through to the SOAP request", async () => {
  const pairs = await getCustomerCategoryTree({ timeoutMs: 180_000 });
  expect(GetCustomerCategoryTreeAsync).toHaveBeenCalledWith(
    {},
    { timeout: 180_000 }
  );
  expect(pairs).toEqual([{ categoryId: 10, companyId: 3975 }]);
});
