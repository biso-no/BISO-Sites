import { beforeEach, expect, mock, test } from "bun:test";

const GetCompaniesAsync = mock();

mock.module("./auth", () => ({
  getValidSession: async () => "session-token",
}));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({ GetCompaniesAsync }),
}));

const { COMPANY_ID_BATCH_SIZE, getCompaniesByIds } = await import("./company");

beforeEach(() => GetCompaniesAsync.mockReset());

test("looks companies up in batches via CompanyIds", async () => {
  const ids = Array.from(
    { length: COMPANY_ID_BATCH_SIZE + 5 },
    (_, i) => i + 1
  );
  GetCompaniesAsync.mockImplementation(
    async (args: { searchParams: { CompanyIds: { int: number[] } } }) => [
      {
        GetCompaniesResult: {
          Company: args.searchParams.CompanyIds.int.map((id) => ({
            Id: id,
            Name: `C${id}`,
          })),
        },
      },
    ]
  );

  const companies = await getCompaniesByIds(ids);

  expect(GetCompaniesAsync).toHaveBeenCalledTimes(2);
  expect(
    GetCompaniesAsync.mock.calls[0][0].searchParams.CompanyIds.int
  ).toHaveLength(COMPANY_ID_BATCH_SIZE);
  expect(
    GetCompaniesAsync.mock.calls[1][0].searchParams.CompanyIds.int
  ).toEqual([1001, 1002, 1003, 1004, 1005]);
  expect(companies).toHaveLength(ids.length);
});

test("normalises a single-company response", async () => {
  GetCompaniesAsync.mockResolvedValue([
    { GetCompaniesResult: { Company: { Id: 7, Name: "Solo" } } },
  ]);
  expect(await getCompaniesByIds([7])).toEqual([{ Id: 7, Name: "Solo" }]);
});

test("rethrows a failed batch instead of returning partial results", async () => {
  GetCompaniesAsync.mockRejectedValue(new Error("boom"));
  await expect(getCompaniesByIds([1])).rejects.toThrow("boom");
});

test("returns [] without calling 24SO for no ids", async () => {
  expect(await getCompaniesByIds([])).toEqual([]);
  expect(GetCompaniesAsync).not.toHaveBeenCalled();
});
