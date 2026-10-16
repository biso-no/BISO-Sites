import { beforeEach, describe, expect, mock, test } from "bun:test";

const GetCompaniesAsync = mock();
const SaveCompaniesAsync = mock();

mock.module("./auth", () => ({
  getValidSession: async () => "session-token",
}));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({
    GetCompaniesAsync,
    SaveCompaniesAsync,
  }),
}));

const { MembershipCustomerLookupError, upsertMembershipCustomer } =
  await import("./company");

const params = {
  email: "s1715738@bi.no",
  employeeId: 1_015_882,
  firstName: "Ola",
  lastName: "Nordmann",
  studentNumber: 1_715_738,
};

describe("upsertMembershipCustomer", () => {
  beforeEach(() => {
    GetCompaniesAsync.mockReset();
    SaveCompaniesAsync.mockReset();
  });

  test("uses the existing customer whose Id is the student number", async () => {
    GetCompaniesAsync.mockResolvedValue([
      { GetCompaniesResult: { Company: { Id: 1_715_738 } } },
    ]);

    await expect(upsertMembershipCustomer(params)).resolves.toBe(1_715_738);
    expect(GetCompaniesAsync).toHaveBeenCalledTimes(1);
    expect(GetCompaniesAsync.mock.calls[0][0].searchParams).toEqual({
      CompanyId: 1_715_738,
    });
    expect(SaveCompaniesAsync).not.toHaveBeenCalled();
  });

  test("creates a missing customer with Id = student number and ExternalId = employee id", async () => {
    GetCompaniesAsync.mockResolvedValue([{ GetCompaniesResult: {} }]);
    SaveCompaniesAsync.mockResolvedValue([
      { SaveCompaniesResult: { Company: { Id: 1_715_738 } } },
    ]);

    await expect(upsertMembershipCustomer(params)).resolves.toBe(1_715_738);

    const saved = SaveCompaniesAsync.mock.calls[0][0].companies.Company;
    expect(saved).toMatchObject({
      Country: "NO",
      CurrencyId: "NOK",
      ExternalId: "1015882",
      FirstName: "Ola",
      Id: 1_715_738,
      Name: "(Student) Nordmann, Ola",
      Private: true,
      Type: "Consumer",
    });
    expect(saved.EmailAddresses).toEqual({
      Primary: { Value: "s1715738@bi.no" },
    });
  });

  test("never creates when the lookup itself fails", async () => {
    GetCompaniesAsync.mockRejectedValue(new Error("24SO timeout"));

    await expect(upsertMembershipCustomer(params)).rejects.toBeInstanceOf(
      MembershipCustomerLookupError
    );
    expect(SaveCompaniesAsync).not.toHaveBeenCalled();
  });
});
