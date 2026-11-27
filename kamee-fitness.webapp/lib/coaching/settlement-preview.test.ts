import { describe, expect, it } from "vitest";
import { previewSettledSplit, previewSettlementCorrection } from "./settlement-preview";

const b = BigInt;
const min = b("-9223372036854775808");
const max = b("9223372036854775807");

describe("informational settled split preview", () => {
  it.each([
    ["101", "8000", "80", "21"],
    ["-101", "8000", "-80", "-21"],
    ["1", "8000", "0", "1"],
    ["-1", "8000", "0", "-1"],
    ["2", "8000", "1", "1"],
    ["-2", "8000", "-1", "-1"],
    ["5", "5000", "2", "3"],
    ["-5", "5000", "-2", "-3"],
    ["3", "3333", "0", "3"],
    ["-3", "3333", "0", "-3"],
    ["10001", "1", "1", "10000"],
    ["-10001", "1", "-1", "-10000"],
    ["101", "0", "0", "101"],
    ["-101", "0", "0", "-101"],
    ["101", "10000", "101", "0"],
    ["-101", "10000", "-101", "0"],
    ["0", "3333", "0", "0"],
    ["9223372036854775807", "8000", "7378697629483820645", "1844674407370955162"],
    ["-9223372036854775808", "8000", "-7378697629483820646", "-1844674407370955162"],
    ["9223372036854775807", "10000", "9223372036854775807", "0"],
    ["-9223372036854775808", "10000", "-9223372036854775808", "0"],
    ["9223372036854775807", "0", "0", "9223372036854775807"],
    ["-9223372036854775808", "0", "0", "-9223372036854775808"],
  ])("splits net %s at %s bps to coach %s and exact residual %s", (net, share, coach, kamee) => {
    expect(previewSettledSplit(b(net), b(share))).toEqual({ coach: b(coach), kamee: b(kamee) });
  });

  it.each([min - b(1), max + b(1)])("rejects out-of-range net money %s", net => {
    expect(() => previewSettledSplit(net, b(8000))).toThrow(RangeError);
  });

  it.each([b(-1), b(10001), max])("rejects an invalid share %s", share => {
    expect(() => previewSettledSplit(b(101), share)).toThrow(RangeError);
  });

  it.each([101, "101", null, undefined, true, Object(b(101))])("rejects non-bigint money %p", net => {
    expect(() => previewSettledSplit(net as bigint, b(8000))).toThrow(TypeError);
  });

  it.each([8000, "8000", null, undefined, true, Object(b(8000))])("rejects non-bigint share %p", share => {
    expect(() => previewSettledSplit(b(101), share as bigint)).toThrow(TypeError);
  });
});

describe("cumulative settlement correction preview", () => {
  it.each([
    { before: "0", after: "1", share: "8000", previous: ["0", "0"], target: ["0", "1"], delta: ["1", "0", "1"] },
    { before: "1", after: "2", share: "8000", previous: ["0", "1"], target: ["1", "1"], delta: ["1", "1", "0"] },
    { before: "2", after: "1", share: "8000", previous: ["1", "1"], target: ["0", "1"], delta: ["-1", "-1", "0"] },
    { before: "1", after: "0", share: "8000", previous: ["0", "1"], target: ["0", "0"], delta: ["-1", "0", "-1"] },
    { before: "-2", after: "-1", share: "8000", previous: ["-1", "-1"], target: ["0", "-1"], delta: ["1", "1", "0"] },
    { before: "1", after: "-1", share: "8000", previous: ["0", "1"], target: ["0", "-1"], delta: ["-2", "0", "-2"] },
    { before: "101", after: "0", share: "8000", previous: ["80", "21"], target: ["0", "0"], delta: ["-101", "-80", "-21"] },
    { before: "-101", after: "0", share: "8000", previous: ["-80", "-21"], target: ["0", "0"], delta: ["101", "80", "21"] },
    { before: "0", after: "2", share: "5000", previous: ["0", "0"], target: ["1", "1"], delta: ["2", "1", "1"] },
    { before: "9223372036854775807", after: "9223372036854775807", share: "8000", previous: ["7378697629483820645", "1844674407370955162"], target: ["7378697629483820645", "1844674407370955162"], delta: ["0", "0", "0"] },
    { before: "-9223372036854775807", after: "0", share: "10000", previous: ["-9223372036854775807", "0"], target: ["0", "0"], delta: ["9223372036854775807", "9223372036854775807", "0"] },
    { before: "0", after: "-9223372036854775808", share: "0", previous: ["0", "0"], target: ["0", "-9223372036854775808"], delta: ["-9223372036854775808", "0", "-9223372036854775808"] },
  ])("splits cumulative targets before subtracting %s", ({ before, after, share, previous, target, delta }) => {
    expect(previewSettlementCorrection(b(before), b(after), b(share))).toEqual({
      previous: { coach: b(previous[0]), kamee: b(previous[1]) },
      target: { coach: b(target[0]), kamee: b(target[1]) },
      delta: { net: b(delta[0]), coach: b(delta[1]), kamee: b(delta[2]) },
    });
  });

  it.each([
    [min, b(0), b(8000)],
    [min, max, b(8000)],
    [max, min, b(8000)],
    [min, b(0), b(0)],
    [max, b(-2), b(10000)],
  ])("rejects correction delta overflow from %s to %s at %s bps", (before, after, share) => {
    expect(() => previewSettlementCorrection(before, after, share)).toThrow(RangeError);
  });

  it.each([min - b(1), max + b(1)])("rejects an out-of-range previous or target even when delta would be zero", net => {
    expect(() => previewSettlementCorrection(net, b(0), b(8000))).toThrow(RangeError);
    expect(() => previewSettlementCorrection(b(0), net, b(8000))).toThrow(RangeError);
    expect(() => previewSettlementCorrection(net, net, b(8000))).toThrow(RangeError);
  });

  it.each([b(-1), b(10001)])("rejects an invalid share even for an unchanged zero bucket %s", share => {
    expect(() => previewSettlementCorrection(b(0), b(0), share)).toThrow(RangeError);
  });

  it.each([0, "0", null, undefined, false, Object(b(0))])("rejects non-bigint previous/target inputs %p", net => {
    expect(() => previewSettlementCorrection(net as bigint, b(0), b(8000))).toThrow(TypeError);
    expect(() => previewSettlementCorrection(b(0), net as bigint, b(8000))).toThrow(TypeError);
  });

  it.each([8000, "8000", null, undefined, false, Object(b(8000))])("rejects a non-bigint correction share %p", share => {
    expect(() => previewSettlementCorrection(b(0), b(0), share as bigint)).toThrow(TypeError);
  });
});
