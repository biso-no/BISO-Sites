import { describe, expect, mock, test } from "bun:test";
import {
  type CustomerApi,
  type FinagoBankAccount,
  type FinagoCustomer,
  isMembershipCustomer,
  normalizeBankAccount,
  payeeName,
  resolveReimbursementCustomer,
} from "./customers";

function fakeApi(
  options: {
    accounts?: FinagoBankAccount[];
    customers?: FinagoCustomer[];
    createdId?: number;
  } = {}
) {
  return {
    addBankAccount: mock(async () => undefined),
    createPersonCustomer: mock(async () => options.createdId ?? 9001),
    findCustomersByEmail: mock(async () => options.customers ?? []),
    listBankAccounts: mock(async () => options.accounts ?? []),
    makeBankAccountDefault: mock(async () => undefined),
  } satisfies CustomerApi;
}

const params = {
  bankAccount: "1234.56.78903",
  email: "S1715738@bi.no ",
  name: "(Student) Heien, Markus",
};

describe("payeeName", () => {
  test("turns a BI account name into first and last name", () => {
    expect(payeeName("(Student) Heien, Markus")).toEqual({
      firstName: "Markus",
      lastName: "Heien",
    });
    expect(payeeName("(Student)  Nygaard Olsen,  Andrea Marie ")).toEqual({
      firstName: "Andrea Marie",
      lastName: "Nygaard Olsen",
    });
  });

  test("keeps any other name in order, with the last word as last name", () => {
    expect(payeeName("Markus Heien")).toEqual({
      firstName: "Markus",
      lastName: "Heien",
    });
    expect(payeeName("Andrea Nygaard Olsen")).toEqual({
      firstName: "Andrea Nygaard",
      lastName: "Olsen",
    });
    expect(payeeName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

describe("isMembershipCustomer", () => {
  test("recognises the membership naming", () => {
    expect(isMembershipCustomer("(Student) Heien, Markus")).toBe(true);
    expect(isMembershipCustomer("Markus Heien")).toBe(false);
  });
});

describe("normalizeBankAccount", () => {
  test("keeps uppercase letters and digits only", () => {
    expect(normalizeBankAccount(" 1234.56.78903 ")).toBe("12345678903");
    expect(normalizeBankAccount("no93 8601 1117 947")).toBe("NO9386011117947");
  });
});

describe("resolveReimbursementCustomer", () => {
  test("uses the customer with that email, never a membership record", async () => {
    const api = fakeApi({
      accounts: [{ isDefault: true, number: "12345678903", type: "bban" }],
      customers: [
        {
          emails: ["s1715738@bi.no"],
          id: 1_715_738,
          name: "(Student) Heien, Markus",
        },
        { emails: ["s1715738@bi.no"], id: 4992, name: "Markus Heien" },
      ],
    });

    await expect(resolveReimbursementCustomer(params, api)).resolves.toEqual({
      bankAccountChange: "unchanged",
      created: false,
      customerId: 4992,
    });
    expect(api.findCustomersByEmail).toHaveBeenCalledWith("s1715738@bi.no");
    expect(api.createPersonCustomer).not.toHaveBeenCalled();
    expect(api.addBankAccount).not.toHaveBeenCalled();
  });

  test("ignores results whose email is not an exact match", async () => {
    const api = fakeApi({
      customers: [{ emails: ["other@bi.no"], id: 77, name: "Someone Else" }],
    });
    const result = await resolveReimbursementCustomer(params, api);
    expect(result.created).toBe(true);
  });

  test("picks the oldest of several matches", async () => {
    const api = fakeApi({
      customers: [
        { emails: ["s1715738@bi.no"], id: 6100, name: "Markus Heien" },
        { emails: ["s1715738@bi.no"], id: 4992, name: "Markus Heien" },
      ],
    });
    const result = await resolveReimbursementCustomer(params, api);
    expect(result.customerId).toBe(4992);
  });

  test("creates a person customer named First Last when none matches", async () => {
    const api = fakeApi({
      createdId: 9001,
      customers: [
        {
          emails: ["s1715738@bi.no"],
          id: 1_715_738,
          name: "(Student) Heien, Markus",
        },
      ],
    });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result).toEqual({
      bankAccountChange: "added",
      created: true,
      customerId: 9001,
    });
    expect(api.createPersonCustomer).toHaveBeenCalledWith({
      email: "s1715738@bi.no",
      firstName: "Markus",
      lastName: "Heien",
    });
  });

  const customer = {
    emails: ["s1715738@bi.no"],
    id: 4992,
    name: "Markus Heien",
  };
  const profileAccountAsDefault = {
    isDefault: true,
    number: "12345678903",
    type: "bban",
  };

  test("case 1: no bank account on file: the profile's is added as default", async () => {
    const api = fakeApi({ customers: [customer] });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result.bankAccountChange).toBe("added");
    expect(api.addBankAccount).toHaveBeenCalledWith(
      4992,
      profileAccountAsDefault
    );
  });

  test("case 2: another account on file: the profile's is added as default", async () => {
    const api = fakeApi({
      accounts: [{ isDefault: true, number: "11112222333", type: "bban" }],
      customers: [customer],
    });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result.bankAccountChange).toBe("added");
    expect(api.addBankAccount).toHaveBeenCalledWith(
      4992,
      profileAccountAsDefault
    );
    expect(api.makeBankAccountDefault).not.toHaveBeenCalled();
  });

  test("case 3: several accounts, the profile's not default: it becomes default", async () => {
    const api = fakeApi({
      accounts: [
        { isDefault: true, number: "11112222333", type: "bban" },
        { isDefault: false, number: "1234.56.78903", type: "bban" },
        { isDefault: false, number: "44445555666", type: "bban" },
      ],
      customers: [customer],
    });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result.bankAccountChange).toBe("made_default");
    // Finago keys the account by the number as stored.
    expect(api.makeBankAccountDefault).toHaveBeenCalledWith(4992, {
      number: "1234.56.78903",
      type: "bban",
    });
    expect(api.addBankAccount).not.toHaveBeenCalled();
  });

  test("case 3: several accounts without the profile's: it is added as default", async () => {
    const api = fakeApi({
      accounts: [
        { isDefault: true, number: "11112222333", type: "bban" },
        { isDefault: false, number: "44445555666", type: "bban" },
      ],
      customers: [customer],
    });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result.bankAccountChange).toBe("added");
    expect(api.addBankAccount).toHaveBeenCalledWith(
      4992,
      profileAccountAsDefault
    );
  });

  test("leaves the accounts alone when the profile's is already default", async () => {
    const api = fakeApi({
      accounts: [
        { isDefault: false, number: "11112222333", type: "bban" },
        { isDefault: true, number: "1234.56.78903", type: "bban" },
      ],
      customers: [customer],
    });

    const result = await resolveReimbursementCustomer(params, api);

    expect(result.bankAccountChange).toBe("unchanged");
    expect(api.addBankAccount).not.toHaveBeenCalled();
    expect(api.makeBankAccountDefault).not.toHaveBeenCalled();
  });

  test("adds an IBAN as an iban account", async () => {
    const api = fakeApi({
      customers: [
        { emails: ["s1715738@bi.no"], id: 4992, name: "Markus Heien" },
      ],
    });
    await resolveReimbursementCustomer(
      { ...params, bankAccount: "NO93 8601 1117 947" },
      api
    );
    expect(api.addBankAccount).toHaveBeenCalledWith(4992, {
      isDefault: true,
      number: "NO9386011117947",
      type: "iban",
    });
  });

  test("refuses without an email or a bank account", async () => {
    const api = fakeApi();
    await expect(
      resolveReimbursementCustomer({ ...params, email: " " }, api)
    ).rejects.toThrow("no email address");
    await expect(
      resolveReimbursementCustomer({ ...params, bankAccount: "" }, api)
    ).rejects.toThrow("no bank account");
    expect(api.findCustomersByEmail).not.toHaveBeenCalled();
  });
});
