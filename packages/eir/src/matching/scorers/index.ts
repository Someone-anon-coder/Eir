import type { FeatureName, Scorer } from "../types.js";
import { scoreAncestorChain } from "./ancestorChain.js";
import { scoreAttrOverlap } from "./attrOverlap.js";
import { scoreBboxProximity } from "./bboxProximity.js";
import { scoreLabelMatch } from "./labelMatch.js";
import { scoreSiblingPosition } from "./siblingPosition.js";
import { scoreTextSimilarity } from "./textSimilarity.js";

export const SCORERS: Readonly<Record<FeatureName, Scorer>> = {
  attrOverlap: scoreAttrOverlap,
  textSimilarity: scoreTextSimilarity,
  labelMatch: scoreLabelMatch,
  ancestorChain: scoreAncestorChain,
  siblingPosition: scoreSiblingPosition,
  bboxProximity: scoreBboxProximity,
};

export {
  scoreAncestorChain,
  scoreAttrOverlap,
  scoreBboxProximity,
  scoreLabelMatch,
  scoreSiblingPosition,
  scoreTextSimilarity,
};
