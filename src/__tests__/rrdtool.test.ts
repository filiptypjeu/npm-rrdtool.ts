import rrdtool, { RrdtoolInfo, RrdtoolDatabase } from "..";
import path from "path";

const p = path.join(__dirname, "_simple.rrd");
const start = 1405942000;

describe("simple test database", () => {
  let db: RrdtoolDatabase<{ test: number }>;
  beforeEach(() => {
    db = rrdtool.open(p);
  });

  test("open", async () => {
    expect(db).toBeTruthy();
  });

  test("open invalid file", async () => {
    expect(() => rrdtool.open("invalid.rrd")).toThrow();
  });

  test("info", async () => {
    const info: RrdtoolInfo = {
      filename: p,
      rrd_version: "0003",
      step: 1,
      last_update: 1405942010,
      header_size: 792,
      ds: [
        {
          name: "test",
          index: 0,
          type: "GAUGE",
          minimal_heartbeat: 1,
          min: 0,
          max: 100,
          last_ds: "75",
          value: 0,
          unknown_sec: 0,
        },
      ],
      rra: [
        {
          cf: "AVERAGE",
          rows: 20,
          cur_row: 11,
          pdp_per_row: 1,
          xff: 0,
          cdp_prep: [
            {
              value: NaN,
              unknown_datapoints: 0,
            },
          ],
        },
        {
          cf: "MAX",
          rows: 1,
          cur_row: 0,
          pdp_per_row: 10,
          xff: 0,
          cdp_prep: [
            {
              value: NaN,
              unknown_datapoints: 0,
            },
          ],
        },
      ],
    };

    expect(await db.info()).toEqual(info);
  });

  test("dump", async () => {
    const db = rrdtool.open(p);
    const dump = await db.dump();
    expect(typeof dump).toBe("string");
    expect(dump).toContain("Round Robin Database Dump");
  });

  test("fetch no arguments", async () => {
    const data = await db.fetch("AVERAGE");
    expect(data).toHaveLength(60*60*24 + 1);
  });

  test("fetch start and end", async () => {
    const end = start + 10;
    let data = await db.fetch("AVERAGE", { start, end });
    expect(data).toHaveLength(11);
    expect(data[0].timestamp).toBe(start);
    expect(data[10].timestamp).toBe(end);
    expect(data.map(d => d.values["test"])).toEqual([35, 75, 50, 85, 65, 0, 20, 95, 25, 0, 75]);

    data = await db.fetch("AVERAGE", { start: start + 5, end: end + 5 });
    expect(data).toHaveLength(11);
    expect(data[0].timestamp).toBe(start + 5);
    expect(data[10].timestamp).toBe(end + 5);
    expect(data.map(d => d.values["test"])).toEqual([0, 20, 95, 25, 0, 75, undefined, undefined, undefined, undefined, undefined]);
  });

  test("update wrong values", async () => {
    expect.assertions(1);
    return expect(db.update({ invalid: 123 } as any)).rejects.toBeTruthy();
  });
});
