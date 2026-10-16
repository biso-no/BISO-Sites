import { describe, expect, test } from "bun:test";
import {
  type ActivePlan,
  buildRosterRows,
  foldMembers,
  resolveMembers,
  selectActivePlans,
} from "./roster";

const NOW = new Date("2026-09-29T12:00:00Z");
const planRows = [
  {
    category: "10",
    expiryDate: "2026-12-31",
    membership_id: "113",
    name: "BISO Membership fall 2026",
    startDate: "2020-01-01",
  },
  {
    category: "11",
    expiryDate: "2027-06-30",
    membership_id: "114",
    name: "BISO Membership fall 2026 and spring 2027",
    startDate: "2020-01-01",
  },
  {
    category: "12",
    expiryDate: "2026-06-30",
    membership_id: "112",
    name: "BISO Membership spring 2026",
    startDate: "2020-01-01",
  },
  {
    category: null,
    expiryDate: "2027-12-31",
    membership_id: "115",
    name: "No category",
    startDate: "2020-01-01",
  },
];

test("selectActivePlans keeps unexpired plans with a category", () => {
  const plans = selectActivePlans(planRows, NOW);
  expect([...plans.keys()].sort()).toEqual([10, 11]);
  expect(plans.get(10)).toEqual({
    categoryId: 10,
    expiryDate: "2026-12-31",
    name: "BISO Membership fall 2026",
    productId: 113,
  });
});

test("selectActivePlans treats a plan expiring today as active", () => {
  expect(
    selectActivePlans([{ ...planRows[0], expiryDate: "2026-09-29" }], NOW).size
  ).toBe(1);
});

test("selectActivePlans reads the DD.MM.YYYY expiry format production uses", () => {
  const plans = selectActivePlans(
    [
      {
        category: "113176",
        expiryDate: "31.12.2026",
        membership_id: "54",
        name: "Semester",
        startDate: "2020-01-01",
      },
      {
        category: "113175",
        expiryDate: "30.06.2026",
        membership_id: "53",
        name: "Old",
        startDate: "2020-01-01",
      },
    ],
    NOW
  );
  expect([...plans.keys()]).toEqual([113_176]);
  expect(plans.get(113_176)?.expiryDate).toBe("2026-12-31");
});

test("selectActivePlans uses the shared membership date rules", () => {
  const plans = selectActivePlans(
    [
      { ...planRows[0], category: "1", expiryDate: "31.02.2027" }, // not a real date
      { ...planRows[0], category: "2", expiryDate: "1.1.2027" }, // short D.M.YYYY
      { ...planRows[0], category: "3", expiryDate: "31/12/2026" }, // slash form
    ],
    NOW
  );
  expect([...plans.keys()].sort()).toEqual([2, 3]);
  expect(plans.get(2)?.expiryDate).toBe("2027-01-01");
});

test("selectActivePlans skips a plan that has not started yet", () => {
  const plans = selectActivePlans(
    [
      {
        category: "20",
        expiryDate: "2027-06-30",
        membership_id: "55",
        name: "BISO Membership spring 2027",
        startDate: "2027-01-01",
      },
    ],
    NOW
  );
  expect(plans.size).toBe(0);
});

test("selectActivePlans skips an unparseable expiry date", () => {
  expect(
    selectActivePlans([{ ...planRows[0], expiryDate: "soon" }], NOW).size
  ).toBe(0);
});

test("foldMembers keeps one plan per customer, the one that expires latest", () => {
  const plans = selectActivePlans(planRows, NOW);
  const members = foldMembers(
    [
      { categoryId: 10, companyId: 1 },
      { categoryId: 11, companyId: 1 },
      { categoryId: 12, companyId: 2 }, // expired plan → not a member
      { categoryId: 99, companyId: 3 }, // non-membership category
      { categoryId: 10, companyId: 4 },
    ],
    plans
  );
  expect([...members.keys()].sort()).toEqual([1, 4]);
  expect(members.get(1)?.productId).toBe(114);
});

test("buildRosterRows joins names, emails and the latest invoice campus", () => {
  const plans = selectActivePlans(planRows, NOW);
  const members = foldMembers([{ categoryId: 10, companyId: 1 }], plans);
  const rows = buildRosterRows({
    companies: [
      { EmailAddresses: { Primary: { Value: "a@b.no" } }, Id: 1, Name: "Ada" },
    ],
    invoiceLines: [
      {
        campusId: "2",
        customerId: 1,
        customerName: "Ada",
        invoicedAt: "2025-08-01T00:00:00Z",
        productId: 113,
      },
      {
        campusId: "1",
        customerId: 1,
        customerName: "Ada",
        invoicedAt: "2026-08-15T00:00:00Z",
        productId: 113,
      },
    ],
    members,
    runId: "run1",
    validCampusIds: new Set(["1", "2"]),
  });
  expect(rows).toEqual([
    {
      $id: "1",
      campus_id: "1",
      company_id: 1,
      email: "a@b.no",
      expiry_date: "2026-12-31",
      invoiced_at: "2026-08-15T00:00:00Z",
      membership_id: "113",
      membership_name: "BISO Membership fall 2026",
      name: "Ada",
      sync_run_id: "run1",
    },
  ]);
});

test("buildRosterRows falls back to the Work email when there is no Primary", () => {
  const members = foldMembers(
    [{ categoryId: 10, companyId: 1 }],
    selectActivePlans(planRows, NOW)
  );
  const [row] = buildRosterRows({
    companies: [
      {
        EmailAddresses: { Work: { Value: "s1512642@bi.no" } },
        Id: 1,
        Name: "Ada",
      },
    ],
    invoiceLines: [],
    members,
    runId: "r",
    validCampusIds: new Set(),
  });
  expect(row?.email).toBe("s1512642@bi.no");
});

test("buildRosterRows nulls a campus id that is not in the campus table", () => {
  const members = foldMembers(
    [{ categoryId: 10, companyId: 1 }],
    selectActivePlans(planRows, NOW)
  );
  const [row] = buildRosterRows({
    companies: [{ Id: 1, Name: "Ada" }],
    invoiceLines: [
      {
        campusId: "0",
        customerId: 1,
        customerName: null,
        invoicedAt: null,
        productId: 113,
      },
    ],
    members,
    runId: "r",
    validCampusIds: new Set(["1"]),
  });
  expect(row?.campus_id).toBeNull();
});

test("buildRosterRows names a member with no company record from the invoice", () => {
  const members = foldMembers(
    [{ categoryId: 10, companyId: 1 }],
    selectActivePlans(planRows, NOW)
  );
  const [row] = buildRosterRows({
    companies: [],
    invoiceLines: [
      {
        campusId: "1",
        customerId: 1,
        customerName: "Invoice Name",
        invoicedAt: null,
        productId: 113,
      },
    ],
    members,
    runId: "r",
    validCampusIds: new Set(["1"]),
  });
  expect(row?.name).toBe("Invoice Name");
});

test("buildRosterRows keeps a member 24SO returned nothing for", () => {
  const members = foldMembers(
    [{ categoryId: 10, companyId: 1 }],
    selectActivePlans(planRows, NOW)
  );
  const [row] = buildRosterRows({
    companies: [],
    invoiceLines: [],
    members,
    runId: "r",
    validCampusIds: new Set(),
  });
  expect(row).toMatchObject({
    campus_id: null,
    company_id: 1,
    email: null,
    name: "",
  });
});

describe("resolveMembers", () => {
  const plans = selectActivePlans(planRows, NOW);
  const fall = plans.get(10);
  const fullYear = plans.get(11);

  test("resolves a tree id that is really an ExternalId to its company", () => {
    const members = foldMembers(
      [{ categoryId: 10, companyId: 1_068_416 }],
      plans
    );
    const resolved = resolveMembers(members, [
      { ExternalId: "1068416", Id: 2_117_936, Name: "Aaland, Amanda" },
    ]);
    expect([...resolved.entries()]).toEqual([[2_117_936, fall as ActivePlan]]);
  });

  test("a real company id wins over another company's matching ExternalId", () => {
    const members = foldMembers([{ categoryId: 10, companyId: 500 }], plans);
    const resolved = resolveMembers(members, [
      { ExternalId: "500", Id: 900, Name: "Other person" },
      { Id: 500, Name: "Real 500" },
    ]);
    expect([...resolved.keys()]).toEqual([500]);
  });

  test("merges a person listed under both ids, keeping the later plan", () => {
    const members = foldMembers(
      [
        { categoryId: 10, companyId: 2_117_936 },
        { categoryId: 11, companyId: 1_068_416 },
      ],
      plans
    );
    const resolved = resolveMembers(members, [
      { ExternalId: "1068416", Id: 2_117_936, Name: "Aaland, Amanda" },
    ]);
    expect([...resolved.entries()]).toEqual([
      [2_117_936, fullYear as ActivePlan],
    ]);
  });

  test("keeps an id that matches no company as-is", () => {
    const members = foldMembers([{ categoryId: 10, companyId: 42 }], plans);
    expect([...resolveMembers(members, []).keys()]).toEqual([42]);
  });
});
