// The M365 tenant domain, in a dependency-free module.
//
// lib/it/graph.ts pulls in the Graph SDK at import time, so anything that only
// needs this constant (the tenant guard, its unit tests) reads it from here
// rather than dragging the SDK along.
export const M365_DOMAIN = process.env.M365_DOMAIN || "biso.no";
