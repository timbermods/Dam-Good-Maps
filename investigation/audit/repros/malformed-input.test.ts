import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { expect, it } from "vitest";
import { parse } from "../../../src/core/format/json";
import { readTimber, writeTimber } from "../../../src/core/format/timber";

const smallWorld = (singletons: string) => `{"GameVersion":"1.1.2.4","Timestamp":"2024-05-01 10:00:00","Singletons":${singletons},"Entities":[]}`;
const world = smallWorld(`{"MapSize":{"Size":{"X":2,"Y":2}},"TerrainMap":{"Voxels":{"Array":"0 0 0 0"}}}`);

it("moves a special __proto__ JSON key into enumerable map singleton data on export", () => {
  const maliciousWorld = smallWorld(`{"MapSize":{"Size":{"X":2,"Y":2}},"TerrainMap":{"Voxels":{"Array":"0 0 0 0"}},"__proto__":{"ForgedSingleton":{"marker":true}}}`);
  const bytes = zipSync({ "world.json": strToU8(maliciousWorld) });

  const reopened = readTimber(writeTimber(readTimber(bytes)));
  expect(Object.hasOwn(reopened.world.singletons, "__proto__")).toBe(false);
  expect(Object.hasOwn(reopened.world.singletons, "ForgedSingleton")).toBe(true);
  expect(reopened.world.singletons.ForgedSingleton).toEqual({ marker: true });
});

it("accepts malformed map metadata with a raw newline in a quoted string", () => {
  const invalidMetadata = `{"Width":2,"Height":2,"MapDescription":"first line\nsecond line"}`;
  expect(() => JSON.parse(invalidMetadata)).toThrow(SyntaxError);
  const bytes = zipSync({ "world.json": strToU8(world), "map_metadata.json": strToU8(invalidMetadata) });
  expect(readTimber(bytes).metadata?.MapDescription).toBe("first line\nsecond line");
});

it("accepts a raw newline inside a quoted JSON string directly", () => {
  const invalidJson = `{"MapDescription":"first line\nsecond line"}`;
  expect(() => JSON.parse(invalidJson)).toThrow(SyntaxError);
  expect(parse(invalidJson)).toEqual({ MapDescription: "first line\nsecond line" });
});
