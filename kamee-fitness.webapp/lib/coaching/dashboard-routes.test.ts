import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlyPayout } from "@/components/coaching/dashboard/FinancePanels";
import { getDashboardReport } from "./dashboard";

describe("sample earnings navigation", () => {
  it.each(["october", "september"])("keeps %s sample figures labelled and links to real earnings without a fictional period", (period) => {
    const html = renderToStaticMarkup(createElement(MonthlyPayout, { report: getDashboardReport(period) }));
    expect(html).toContain("Sample");
    expect(html).toContain("Illustrative amounts; no payout is scheduled");
    expect(html).toContain('href="/coaching/earnings"');
    expect(html).toContain("View your earnings");
    expect(html).not.toContain("?period=");
  });
});
