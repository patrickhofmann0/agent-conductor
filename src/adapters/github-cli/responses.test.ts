import { describe, expect, it } from "vitest";

import { jsonLines, toComments, toReviews } from "./responses.js";

const lines = (...values: unknown[]): string =>
  values.map((value) => JSON.stringify(value)).join("\n") + "\n";

describe("jsonLines", () => {
  it("skips empty lines", () => {
    expect(jsonLines('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

describe("toReviews", () => {
  it("maps submitted reviews and drops pending and dismissed ones", () => {
    const output = lines(
      {
        user: { login: "alice" },
        state: "CHANGES_REQUESTED",
        body: "Fix",
        submitted_at: "2026-11-11T10:00:00Z",
        author_association: "MEMBER",
      },
      {
        user: null,
        state: "APPROVED",
        body: null,
        submitted_at: "2026-11-11T11:00:00Z",
        author_association: "NONE",
      },
      {
        user: { login: "bob" },
        state: "COMMENTED",
        body: "Hm",
        submitted_at: "2026-11-11T12:00:00Z",
        author_association: "COLLABORATOR",
      },
      {
        user: { login: "bob" },
        state: "PENDING",
        body: "",
        author_association: "OWNER",
      },
      {
        user: { login: "bob" },
        state: "DISMISSED",
        body: "",
        submitted_at: "2026-11-11T12:00:00Z",
        author_association: "OWNER",
      },
    );

    expect(toReviews(output)).toEqual([
      {
        author: "alice",
        authorCanApprove: true,
        state: "request_changes",
        body: "Fix",
        submittedAt: Date.parse("2026-11-11T10:00:00Z"),
      },
      {
        author: "ghost",
        authorCanApprove: false,
        state: "approve",
        body: "",
        submittedAt: Date.parse("2026-11-11T11:00:00Z"),
      },
      {
        author: "bob",
        authorCanApprove: true,
        state: "comment",
        body: "Hm",
        submittedAt: Date.parse("2026-11-11T12:00:00Z"),
      },
    ]);
  });

  it("rejects unexpected data", () => {
    expect(() => toReviews('{"state":1}\n')).toThrow();
  });
});

describe("toComments", () => {
  it("maps comments", () => {
    const output = lines(
      {
        user: { login: "carol" },
        body: "Nit",
        created_at: "2026-11-11T09:00:00Z",
        author_association: "OWNER",
      },
      {
        user: null,
        body: null,
        created_at: "2026-11-11T09:30:00Z",
        author_association: "CONTRIBUTOR",
      },
    );

    expect(toComments(output)).toEqual([
      {
        author: "carol",
        authorCanApprove: true,
        body: "Nit",
        createdAt: Date.parse("2026-11-11T09:00:00Z"),
      },
      {
        author: "ghost",
        authorCanApprove: false,
        body: "",
        createdAt: Date.parse("2026-11-11T09:30:00Z"),
      },
    ]);
  });
});
