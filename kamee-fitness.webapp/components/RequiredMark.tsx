/** Visual marker plus a spoken equivalent for required fields. */
export function RequiredMark() {
  return <><span aria-hidden="true" className="text-ember-400"> *</span><span className="sr-only"> (required)</span></>;
}
