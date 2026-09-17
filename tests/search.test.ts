import { describe, expect, test } from "bun:test";
import { formatFtsQuery, generateSnippet, escapeHtml } from "../src/services/search.service.ts";

describe("Search Utility Unit Tests", () => {
  describe("formatFtsQuery", () => {
    test("formats simple words into +word* prefix wildcard expressions", () => {
      expect(formatFtsQuery("invoice total")).toBe("+invoice* +total*");
    });

    test("preserves exact phrase searches wrapped in double quotes", () => {
      expect(formatFtsQuery('"invoice total"')).toBe('"invoice total"');
    });

    test("strips unsafe boolean operators and extra whitespace", () => {
      expect(formatFtsQuery("hello +world* ~test")).toBe("+hello* +world* +test*");
    });

    test("returns empty string for empty or blank input", () => {
      expect(formatFtsQuery("")).toBe("");
      expect(formatFtsQuery("   ")).toBe("");
    });
  });

  describe("escapeHtml", () => {
    test("escapes HTML control characters", () => {
      expect(escapeHtml('<script>alert("XSS & test")</script>')).toBe(
        "&lt;script&gt;alert(&quot;XSS &amp; test&quot;)&lt;/script&gt;"
      );
    });
  });

  describe("generateSnippet", () => {
    test("wraps matching search terms in <mark> tags", () => {
      const text = "Payment Invoice #12345 total amount $99.00 paid";
      const snippet = generateSnippet(text, "Invoice");
      expect(snippet).toContain("<mark>Invoice</mark>");
    });

    test("highlights multiple query terms", () => {
      const text = "Receipt #999 Invoice #12345 total amount $99.00";
      const snippet = generateSnippet(text, "Invoice total");
      expect(snippet).toContain("<mark>Invoice</mark>");
      expect(snippet).toContain("<mark>total</mark>");
    });

    test("escapes HTML in snippet while allowing <mark> tags", () => {
      const text = "HTML <tag> & text Invoice snippet";
      const snippet = generateSnippet(text, "Invoice");
      expect(snippet).toContain("&lt;tag&gt;");
      expect(snippet).toContain("&amp;");
      expect(snippet).toContain("<mark>Invoice</mark>");
    });

    test("truncates long text gracefully around match", () => {
      const text = "A".repeat(200) + " TargetMatch " + "B".repeat(200);
      const snippet = generateSnippet(text, "TargetMatch", 100);
      expect(snippet).toContain("<mark>TargetMatch</mark>");
      expect(snippet.length).toBeLessThan(160);
    });
  });
});
