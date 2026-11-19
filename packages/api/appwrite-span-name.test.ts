import { describe, expect, it } from "vitest";
import { spanNameForAppwriteRequest } from "./appwrite-span-name";

describe("spanNameForAppwriteRequest", () => {
  it("templates the id after each id-bearing collection", () => {
    expect(
      spanNameForAppwriteRequest(
        "GET /tablesdb/app/tables/events/rows/6745a1b2"
      )
    ).toBe("GET /tablesdb/app/tables/events/rows/{id}");
    expect(
      spanNameForAppwriteRequest(
        "GET /databases/app/collections/news/documents/abc"
      )
    ).toBe("GET /databases/app/collections/news/documents/{id}");
    expect(spanNameForAppwriteRequest("DELETE /users/u1/sessions/s1")).toBe(
      "DELETE /users/{id}/sessions/{id}"
    );
    expect(
      spanNameForAppwriteRequest("GET /storage/buckets/media/files/f1/view")
    ).toBe("GET /storage/buckets/media/files/{id}/view");
    expect(
      spanNameForAppwriteRequest("PATCH /teams/t1/memberships/m1/status")
    ).toBe("PATCH /teams/{id}/memberships/{id}/status");
    expect(spanNameForAppwriteRequest("GET /functions/fn/executions/e1")).toBe(
      "GET /functions/fn/executions/{id}"
    );
    expect(spanNameForAppwriteRequest("DELETE /tokens/t1")).toBe(
      "DELETE /tokens/{id}"
    );
    expect(
      spanNameForAppwriteRequest(
        "PATCH /tablesdb/app/tables/t/rows/r1/count/increment"
      )
    ).toBe("PATCH /tablesdb/app/tables/t/rows/{id}/count/increment");
  });

  it("does not treat a table or bucket named like a collection as one", () => {
    expect(
      spanNameForAppwriteRequest(
        "GET /tablesdb/app/tables/documents/rows/6745a1b2c3d4"
      )
    ).toBe("GET /tablesdb/app/tables/documents/rows/{id}");
    expect(
      spanNameForAppwriteRequest("GET /tablesdb/app/tables/teams/rows/r1")
    ).toBe("GET /tablesdb/app/tables/teams/rows/{id}");
    expect(
      spanNameForAppwriteRequest("GET /storage/buckets/documents/files/f1/view")
    ).toBe("GET /storage/buckets/documents/files/{id}/view");
    expect(
      spanNameForAppwriteRequest("GET /tablesdb/app/tables/documents/rows")
    ).toBe("GET /tablesdb/app/tables/documents/rows");
    expect(spanNameForAppwriteRequest("GET /teams/abc/memberships/m1")).toBe(
      "GET /teams/{id}/memberships/{id}"
    );
    expect(spanNameForAppwriteRequest("GET /account")).toBe("GET /account");
  });

  it("gives every row of a table the same name", () => {
    const names = ["r1", "6745a1b2c3d4e5f6a7b8", "x-y"].map((id) =>
      spanNameForAppwriteRequest(`GET /tablesdb/app/tables/events/rows/${id}`)
    );
    expect(new Set(names).size).toBe(1);
  });

  it("leaves list calls and Appwrite's own route names alone", () => {
    expect(spanNameForAppwriteRequest("GET /tablesdb/app/tables/t/rows")).toBe(
      "GET /tablesdb/app/tables/t/rows"
    );
    expect(spanNameForAppwriteRequest("GET /users")).toBe("GET /users");
    expect(spanNameForAppwriteRequest("GET /account/sessions/current")).toBe(
      "GET /account/sessions/current"
    );
    expect(
      spanNameForAppwriteRequest("GET /account/tokens/oauth2/google")
    ).toBe("GET /account/tokens/oauth2/google");
    expect(spanNameForAppwriteRequest("POST /account/sessions/email")).toBe(
      "POST /account/sessions/email"
    );
    expect(spanNameForAppwriteRequest("POST /users/argon2")).toBe(
      "POST /users/argon2"
    );
  });

  it("passes a bare method through", () => {
    expect(spanNameForAppwriteRequest("GET")).toBe("GET");
  });
});
