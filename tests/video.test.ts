import { describe, expect, it } from "vitest";
import { scrubIso6709, scrubVideoLocation } from "@/lib/listings/video";

const ascii = (text: string) => new TextEncoder().encode(text);
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Builds a box: 4-byte size, 4-byte type, payload. */
function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(ascii(type), 4);
  out.set(payload, 8);
  return out;
}
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe("video location scrub", () => {
  it("blanks iPhone and Android location strings, keeping the length", () => {
    const bytes = ascii("xx+23.8103+090.4125+012.345/yy ©xyz+22.3569-091.7832/zz");
    const before = bytes.length;
    expect(scrubIso6709(bytes)).toBe(2);
    expect(bytes.length).toBe(before);
    expect(text(bytes)).toBe("xx+00.0000+000.0000+000.000/yy ©xyz+00.0000-000.0000/zz");
  });

  it("leaves other numbers alone", () => {
    const bytes = ascii("version +1.2+3.4 price +2500.00 date 2026-10-18 size +12.5");
    const copy = text(bytes);
    expect(scrubIso6709(bytes)).toBe(0);
    expect(text(bytes)).toBe(copy);
  });

  it("only touches the moov box of an MP4", () => {
    const location = "+23.8103+090.4125/";
    const file = join(box("ftyp", ascii("isom")), box("mdat", ascii(`frames ${location}`)), box("moov", box("udta", ascii(`©xyz${location}`))));
    expect(scrubVideoLocation(file)).toBe(1);
    const out = text(file);
    expect(out).toContain(`frames ${location}`); // picture data untouched
    expect(out).toContain("©xyz+00.0000+000.0000/");
  });
});
