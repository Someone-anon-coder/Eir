import { createPrng } from "../prng.js";
import { mergePayloads } from "../groundTruth.js";
import type { OverridePayload } from "../targets.js";

/**
 * The two classes added for the healer comparison. They are deliberately
 * not in `MUTATION_CLASSES`: that list drives `bench:all` and the committed
 * 8-class baseline, which must stay byte-identical. These classes are the
 * counterweight to the original eight, which were designed alongside the
 * matcher they measure.
 */
export const NEW_KIND_CLASSES = ["real-regression", "flow-change"] as const;
export type NewKindClass = (typeof NEW_KIND_CLASSES)[number];

export function isNewKindClass(value: string): value is NewKindClass {
  return (NEW_KIND_CLASSES as readonly string[]).includes(value);
}

export interface NewKindTarget {
  readonly id: string;
  readonly mutationClass: NewKindClass;
  readonly payload: OverridePayload;
}

const regress = (key: string): OverridePayload => ({ regress: [key] });
const flow = (key: string): OverridePayload => ({ flow: [key] });

export const REAL_REGRESSION_TARGETS: readonly NewKindTarget[] = [
  {
    id: "real-regression.devices.saveIgnoresEdit",
    mutationClass: "real-regression",
    payload: regress("devices.saveIgnoresEdit"),
  },
  {
    id: "real-regression.provisioning.successBecomesError",
    mutationClass: "real-regression",
    payload: regress("provisioning.successBecomesError"),
  },
  {
    id: "real-regression.account.confirmDoesNothing",
    mutationClass: "real-regression",
    payload: regress("account.confirmDoesNothing"),
  },
  {
    id: "real-regression.wizard.reviewShowsWrongValue",
    mutationClass: "real-regression",
    payload: regress("wizard.reviewShowsWrongValue"),
  },
  {
    id: "real-regression.wizard.submitDoesNothing",
    mutationClass: "real-regression",
    payload: regress("wizard.submitDoesNothing"),
  },
  {
    id: "real-regression.devices.removeKeepsRow",
    mutationClass: "real-regression",
    payload: regress("devices.removeKeepsRow"),
  },
  {
    id: "real-regression.login.acceptsEmptyPassword",
    mutationClass: "real-regression",
    payload: regress("login.acceptsEmptyPassword"),
  },
];

export const FLOW_CHANGE_TARGETS: readonly NewKindTarget[] = [
  {
    id: "flow-change.account.deleteInOverflow",
    mutationClass: "flow-change",
    payload: flow("account.deleteInOverflow"),
  },
  {
    id: "flow-change.provisioning.confirmStep",
    mutationClass: "flow-change",
    payload: flow("provisioning.confirmStep"),
  },
  {
    id: "flow-change.wizard.termsStep",
    mutationClass: "flow-change",
    payload: flow("wizard.termsStep"),
  },
  {
    id: "flow-change.devices.removeConfirm",
    mutationClass: "flow-change",
    payload: flow("devices.removeConfirm"),
  },
  {
    id: "flow-change.nav.logoutInMenu",
    mutationClass: "flow-change",
    payload: flow("nav.logoutInMenu"),
  },
];

export interface NewKindRun {
  readonly mutationClass: NewKindClass;
  readonly seed: number;
  readonly overridePayload: OverridePayload;
  readonly targets: readonly NewKindTarget[];
}

/**
 * Seeded selection through the project's own PRNG. Today the pool is small
 * enough that every candidate is live, so the seed fixes only the order;
 * routing it through the shuffle keeps selection a function of
 * (class, seed) so the pool can grow without changing the contract.
 */
export function buildNewKindRun(mutationClass: NewKindClass, seed: number): NewKindRun {
  const pool = mutationClass === "real-regression" ? REAL_REGRESSION_TARGETS : FLOW_CHANGE_TARGETS;
  const targets = createPrng(seed).shuffle(pool);
  return {
    mutationClass,
    seed,
    overridePayload: mergePayloads(targets.map((t) => t.payload)),
    targets,
  };
}
