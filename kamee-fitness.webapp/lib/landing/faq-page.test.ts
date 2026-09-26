import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaqPage, { metadata } from "@/app/faq/page";
import { HELP_FAQ } from "@/lib/landing/content";

describe("help FAQ page", () => {
  const markup = renderToStaticMarkup(createElement(FaqPage));

  it("labels its category navigation for people using assistive technology", () => {
    expect(markup).toContain('aria-label="FAQ categories"');
  });

  it("ends with a clearly labelled route to Kamee support", () => {
    expect(markup).toContain('aria-label="Contact Kamee support"');
  });

  it("identifies the mobile-linked FAQ route as its canonical page", () => {
    expect(metadata.alternates).toEqual({ canonical: "/faq" });
  });

  it("uses FAQ-specific metadata when the support page is shared", () => {
    expect(metadata.openGraph).toMatchObject({
      title: "FAQ · Kamee Fitness",
      url: "/faq",
    });
    expect(metadata.twitter).toMatchObject({
      title: "FAQ · Kamee Fitness",
    });
  });

  it("lets keyboard users skip directly to the answer list", () => {
    expect(markup).toContain('href="#faq-answers"');
    expect(markup).toContain('id="faq-answers"');
  });

  it("keeps the focused skip link visible and its target clear of sticky navigation", () => {
    const skipLink = markup.match(/<a href="#faq-answers" class="([^"]+)"/);
    const answerTarget = markup.match(/<article id="faq-answers"[^>]*class="([^"]+)"/);

    expect(skipLink?.[1]).not.toContain("sr-only");
    expect(answerTarget?.[1]).toContain("scroll-mt-24");
  });

  it("groups the supporting page links in a labelled footer navigation", () => {
    expect(markup).toContain('aria-label="FAQ footer"');
  });

  it("does not preload decorative imagery that is hidden on mobile", () => {
    expect(markup).not.toContain('rel="preload" as="image"');
  });

  it("renders every support question expanded in its section", () => {
    for (const section of HELP_FAQ) {
      expect(markup).toContain(`id="${section.id}"`);

      for (const item of section.items) {
        expect(markup).toContain(renderToStaticMarkup(item.q));
      }
    }

    expect(markup).not.toContain("<details");
  });
});
