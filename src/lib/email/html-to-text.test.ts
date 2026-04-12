import { describe, it, expect } from "vitest";
import { htmlToText } from "./html-to-text";

describe("htmlToText", () => {
  it("strips all tags leaving text content", () => {
    expect(htmlToText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("converts <br> to newline", () => {
    expect(htmlToText("Line 1<br>Line 2")).toBe("Line 1\nLine 2");
  });

  it("removes <style> and <script> blocks entirely", () => {
    const html = `<style>body{color:red}</style><script>alert(1)</script><p>Safe</p>`;
    expect(htmlToText(html)).toBe("Safe");
  });

  it("decodes basic HTML entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
    expect(htmlToText("<p>1 &lt; 2 &gt; 0</p>")).toBe("1 < 2 > 0");
    expect(htmlToText("<p>a&nbsp;b</p>")).toBe("a b");
  });

  it("collapses 3+ newlines to 2", () => {
    expect(htmlToText("<p>A</p><p>B</p>")).toBe("A\n\nB");
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlToText("<p>   hello   </p>")).toBe("hello");
  });
});
