// Every premise recipe, in report order, and the natural dam narrows prototype.

import type { Recipe } from "./lib";
import { hangingLake, mesaField, twinFalls, volcano } from "./landmarks";
import { spurNarrows } from "./narrows";
import { craterLake, heartLake, moatIsland, spiralMountain } from "./shapes";
import { northSouth, oxbowLake } from "./water";

export const RECIPES: Recipe[] = [
  moatIsland,
  craterLake,
  spiralMountain,
  heartLake,
  volcano,
  hangingLake,
  mesaField,
  twinFalls,
  oxbowLake,
  northSouth,
  spurNarrows,
];
