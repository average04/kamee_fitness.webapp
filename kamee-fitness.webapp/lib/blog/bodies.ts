/**
 * Static MDX imports keyed by slug. This is the only module that imports
 * .mdx — keeping it separate stops the hub and sitemap from pulling 16 post
 * bundles into their import graph.
 *
 * The Record<PostSlug, ...> annotation is load-bearing: tsc fails the build if
 * a post is added to the registry without a body here.
 */
import type { ComponentType } from "react";
import type { PostSlug } from "./posts";

import TypesOfRunningWorkouts from "@/content/blog/types-of-running-workouts.mdx";
import EasyRun from "@/content/blog/easy-run.mdx";
import BaseRun from "@/content/blog/base-run.mdx";
import LongRun from "@/content/blog/long-run.mdx";
import RecoveryRun from "@/content/blog/recovery-run.mdx";
import ProgressionRun from "@/content/blog/progression-run.mdx";
import TempoRun from "@/content/blog/tempo-run.mdx";
import IntervalRun from "@/content/blog/interval-run.mdx";
import Vo2MaxIntervals from "@/content/blog/vo2-max-intervals.mdx";
import FartlekRun from "@/content/blog/fartlek-run.mdx";
import Strides from "@/content/blog/strides.mdx";
import HillRepeats from "@/content/blog/hill-repeats.mdx";
import TrailRun from "@/content/blog/trail-run.mdx";
import RacePaceRun from "@/content/blog/race-pace-run.mdx";
import TimeTrial from "@/content/blog/time-trial.mdx";
import ShakeoutRun from "@/content/blog/shakeout-run.mdx";

export const BODIES: Record<PostSlug, ComponentType> = {
  "types-of-running-workouts": TypesOfRunningWorkouts,
  "easy-run": EasyRun,
  "base-run": BaseRun,
  "long-run": LongRun,
  "recovery-run": RecoveryRun,
  "progression-run": ProgressionRun,
  "tempo-run": TempoRun,
  "interval-run": IntervalRun,
  "vo2-max-intervals": Vo2MaxIntervals,
  "fartlek-run": FartlekRun,
  strides: Strides,
  "hill-repeats": HillRepeats,
  "trail-run": TrailRun,
  "race-pace-run": RacePaceRun,
  "time-trial": TimeTrial,
  "shakeout-run": ShakeoutRun,
};
