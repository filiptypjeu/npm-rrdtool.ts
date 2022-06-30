import rrdtool from "..";
import path from "path";
import assert from "assert";

const DATA = [35, 75, 50, 85, 65, 0, 20, 95, 25, 0, 75];

describe("rrd", () => {
  it("should open a basic file", async () => {
    const start = 1405942000;

    const f = path.join(__dirname, "_simple.rrd");
    const db = rrdtool.open(f);

    const src = DATA.map((v, i) => [start + i, v]);

    let data = await db.fetch("MAX", {
      start: start + 10,
      end: start + 10,
    });
    assert.equal(data.length, 1);
    assert.equal(data[0].timestamp, start + 10);
    assert.equal(data[0].values.test, 95);

    data = await db.fetch("AVERAGE", { start: start, end: start + 10 });
    assert.equal(data.length, src.length);

    src.forEach((src, i) => {
      assert.equal(data[i].timestamp, src[0]);
      assert.equal(data[i].values.test, src[1]);
    });
  });
});
