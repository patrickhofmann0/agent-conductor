import { z } from "zod";

export const ROLES = ["po", "planner", "coder", "tester", "reviewer"] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;

/** Which roles run in the next review-loop iteration. */
export const routeSchema = z.enum(["coder", "tester", "both"]);

export type Route = z.infer<typeof routeSchema>;
