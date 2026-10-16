import { expect, mock, test } from "bun:test";

const GetCompaniesAsync = mock(async () => [
  {
    GetCompaniesResult: {
      Company: { ExternalId: "1068416", Id: 2_117_936, Name: "Aaland, Amanda" },
    },
  },
]);

mock.module("./auth", () => ({
  getValidSession: async () => "session-token",
}));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({ GetCompaniesAsync }),
}));

const { getAllCompanies } = await import("./company");

test("lists every company in one ChangedAfter search, with ExternalId", async () => {
  const companies = await getAllCompanies({ timeoutMs: 300_000 });

  expect(GetCompaniesAsync).toHaveBeenCalledTimes(1);
  const [args, options] = GetCompaniesAsync.mock.calls[0] as unknown as [
    {
      returnProperties: { string: string[] };
      searchParams: { ChangedAfter: string };
    },
    { timeout: number },
  ];
  expect(args.searchParams.ChangedAfter).toBe("1990-01-01T00:00:00");
  expect(args.returnProperties.string).toEqual(
    expect.arrayContaining(["Id", "ExternalId", "Name", "EmailAddresses"])
  );
  expect(options).toEqual({ timeout: 300_000 });
  expect(companies).toEqual([
    { ExternalId: "1068416", Id: 2_117_936, Name: "Aaland, Amanda" },
  ]);
});
