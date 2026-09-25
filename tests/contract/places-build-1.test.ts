// Real places (ROADMAP "Real places"): every map validates and is the same file, shard 1 of 3
// (tests/contract/placesCommon.ts; split so the builds run side by side).

import { checkShard } from "./placesCommon";

checkShard(0, 3);
