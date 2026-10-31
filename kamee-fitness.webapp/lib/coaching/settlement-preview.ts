const MIN_SIGNED_64 = BigInt("-9223372036854775808");
const MAX_SIGNED_64 = BigInt("9223372036854775807");
const BASIS_POINTS = BigInt(10000);

type SplitPreview = { coach: bigint; kamee: bigint };
type CorrectionPreview = {
  previous: SplitPreview;
  target: SplitPreview;
  delta: { net: bigint; coach: bigint; kamee: bigint };
};

function signed64(value: bigint, label: string): bigint {
  if (typeof value !== "bigint") throw new TypeError(`${label} must be a bigint`);
  if (value < MIN_SIGNED_64 || value > MAX_SIGNED_64) throw new RangeError(`${label} exceeds signed 64-bit money`);
  return value;
}

/** Informational arithmetic only; this does not recognize earnings or authorize cash. */
export function previewSettledSplit(netMinor: bigint, shareBps: bigint): SplitPreview {
  signed64(netMinor, "Net minor");
  if (typeof shareBps !== "bigint") throw new TypeError("Share basis points must be a bigint");
  if (shareBps < BigInt(0) || shareBps > BASIS_POINTS) throw new RangeError("Share basis points must be between 0 and 10000");
  // BigInt intermediates are unbounded; division truncates toward zero, including negatives.
  const coach = signed64((netMinor * shareBps) / BASIS_POINTS, "Coach preview");
  const kamee = signed64(netMinor - coach, "Kamee preview");
  return { coach, kamee };
}

/** Split cumulative targets before subtracting; splitting a per-file delta changes rounding. */
export function previewSettlementCorrection(previousNetMinor: bigint, nextNetMinor: bigint, shareBps: bigint): CorrectionPreview {
  const previous = previewSettledSplit(previousNetMinor, shareBps);
  const target = previewSettledSplit(nextNetMinor, shareBps);
  return {
    previous,
    target,
    delta: {
      net: signed64(nextNetMinor - previousNetMinor, "Net delta preview"),
      coach: signed64(target.coach - previous.coach, "Coach delta preview"),
      kamee: signed64(target.kamee - previous.kamee, "Kamee delta preview"),
    },
  };
}
