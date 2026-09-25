import test from "node:test";
import assert from "node:assert/strict";
import { validateInput, compare } from "../bench/measure";
test("bench rejects truncated maps, non-integers and invalid sources", () => {
  const good = {
    W: 4,
    H: 4,
    heights: new Array(16).fill(4),
    waterSources: [{ x: 1, y: 1, strength: 1 }],
  };
  assert.deepEqual(validateInput(good), { W: 4, H: 4 });
  assert.throws(() => validateInput({ ...good, heights: [4] }));
  assert.throws(() =>
    validateInput({ ...good, heights: new Array(16).fill(2.5) }),
  );
  assert.throws(() =>
    validateInput({ ...good, waterSources: [{ x: 4, y: 1, strength: 1 }] }),
  );
  assert.throws(() =>
    validateInput({
      ...good,
      waterSources: [...good.waterSources, ...good.waterSources],
    }),
  );
});
test("missing values never become a good score", () => {
  const r = compare(
    { network: { sinuosity: { p50: null } }, relief: {} },
    {
      scalars: { sinuosity: { nRegions: 10, p10: 1, p50: 1.2, p90: 2 } },
      histograms: {},
    },
  );
  assert.equal(r.scalars.sinuosity.status, "insufficient evidence");
  assert.equal(r.histograms.heightHistogram.totalVariation, null);
});
test("histograms and valley sections require five measured regions", () => {
  const relief = {
    heightHistogram: [0.5, 0.5],
    slopeHistogram: [1, 0],
    valleyCrossSectionMean: [2, 0, 2],
  };
  const target = {
    scalars: {},
    histograms: { ...relief },
    histogramSupport: {
      heightHistogram: { nRegions: 4 },
      slopeHistogram: { nRegions: 5 },
      valleyCrossSectionMean: { nRegions: 4 },
    },
  };
  const r = compare({ relief }, target);
  assert.equal(r.histograms.heightHistogram.totalVariation, null);
  assert.equal(r.histograms.slopeHistogram.totalVariation, 0);
  assert.equal(r.valleyCrossSection.rootMeanSquareLevels, null);
});
