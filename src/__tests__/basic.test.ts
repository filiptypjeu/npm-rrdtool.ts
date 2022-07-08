import rrdtool from "..";
import fs from "fs";
import path from "path";

const randomValues = (n: number) => {
  const values: number[] = [];

  while (values.length < n) {
    values.push(Number((Math.random() * 100).toFixed(4)));
  }

  return values;
}

const p = path.join(__dirname, "temp.rrd");
const start = 1405942000;

describe("tests on temporary databases", () => {
  afterEach(() => fs.unlinkSync(p));

  test("create", async () => {
    const db = await rrdtool.create(p, [
      "DS:test:GAUGE:1:0:100",
      "RRA:AVERAGE:0:1:10",
    ]);

    expect(db).toBeTruthy();
  });

  test("update and fetch 10 values", async () => {
    const db = await rrdtool.create<{ test: number }>(p, [
      "DS:test:GAUGE:1:0:100",
      "RRA:AVERAGE:0:1:10",
    ], { start, step: 1 });

    const data = randomValues(10).map((v, i) => ({ timestamp: start + i, values: { test: v } }));

    for (const s of data) {
      await db.update(s.values, s);
    }

    let result = await db.fetch("AVERAGE", { start, end: start + 9 });
    expect(result).toEqual(data);

    const target = data[5];
    result = await db.fetch("AVERAGE", { start: target.timestamp, end: target.timestamp });
    expect(result).toEqual([target]);
  });

  test("update and fetch an average over 20 seconds", async () => {
    const db = await rrdtool.create<{ test: number }>(p, [
      "DS:test:GAUGE:1:0:100",
      "RRA:AVERAGE:0:1:20",
      "RRA:AVERAGE:0:20:1",
    ], { start, step: 1 });

    const data = randomValues(21).map((v, i) => ({ timestamp: start + i, values: { test: v } }));

    data.forEach(d => db.update(d.values, d));

    const result = await db.fetch("AVERAGE", { start: start + 19, end: start + 19, resolution: 20 });
    expect(result).toHaveLength(1);

    const avg = data.slice(1).reduce((sum, v) => sum + v.values.test / 20, 0);
    expect(result[0].values.test).toBeCloseTo(avg, 4);
  });

  test("update and fetch with two data sources", async () => {
    const db = await rrdtool.create(p, [
      "DS:test1:GAUGE:1:0:100",
      "DS:test2:GAUGE:1:0:100",
      "RRA:AVERAGE:0:1:10",
    ], { start, step: 1 });

    const data1 = randomValues(10);
    const data2 = randomValues(10);
    const data = data1.map((v, i) => ({
      timestamp: start + i,
      values: {
        test1: v,
        test2: data2[i],
      }
    }));
    data;

    for (const d of data) {
      await db.update(d.values, d);
    }

    const result = await db.fetch("AVERAGE", { start, end: start + 9 });
    expect(result).toEqual(data);

  });

  test("update with default timestamp", async () => {
    const t = rrdtool.now();

    const db = await rrdtool.create < { test: number }>(p, [
      "DS:test:GAUGE:1:0:100",
      "RRA:AVERAGE:0.99:1:10",
    ], { step: 1 });

    await db.update({ test: 42 }, { timestamp: t - 1 });
    await db.update({ test: 42 });

    const result = await db.fetch("AVERAGE", { start: t, end: t });
    expect(result).toEqual([{
      timestamp: t,
      values: { test: 42 },
    }]);
  });
});
