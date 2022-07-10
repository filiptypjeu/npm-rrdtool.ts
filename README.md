
# rrdtool.ts

This is a wrapper for `rrdtool` written in TypeScript. Inspired by the `rrdtool` NPM package https://github.com/LinusU/node-rrdtool.

## Usage

```ts
import rrdtool from "rrdtool.ts";

interface MyData {
  test: number;
};

const start = rrdtool.now() - 10;
const db = await rrdtool.create<MyData>("test.rrd", { start, step: 1 }, [
  "DS:test:GAUGE:1:0:100",
  "RRA:AVERAGE:0.5:1:10"
]);

db.update({ test: 15 }, { timestamp: start + 0 });
db.update({ test: 90 }, { timestamp: start + 1 });
db.update({ test: 35 }, { timestamp: start + 2 });
db.update({ test: 45 }, { timestamp: start + 3 });
db.update({ test: 85 }, { timestamp: start + 4 });
db.update({ test: 10 }, { timestamp: start + 5 });
db.update({ test: 60 }, { timestamp: start + 6 });
db.update({ test: 55 }, { timestamp: start + 7 });
db.update({ test: 75 }, { timestamp: start + 8 });
db.update({ test: 25 }, { timestamp: start + 9 });

const data = await db.fetch("AVERAGE", { start, end: start + 9});
const info = await db.info();
const graphInfo = await rrdtool.graph([
  "DEF:mydef=test.rrd:test:AVERAGE",
  "LINE2:mydef",
  "VDEF:myvdef=mydef,MAXIMUM",
  "PRINT:myvdef:Maximum\\: %6.2lf",
], {
  filename: "test.png",
  verbose: true,
  image: {
    width: 500,
    height: 300,
    backgroundColor: [10, 10, 10],
  },
  border: 3,
  x: {
    start,
    end: start + 20,
  },
  y: {
    label: "My vertical label",
  },
  text: {
    color: [255, 0, 255],
    defaultFont: 10,
  },
  grid: {
    axisColor: [0, 0, 255],
    arrowColor: [0, 255, 0],
    baseColor: [150, 150, 150],
    majorColor: [50, 50, 50],
  },
  graph: {
    canvasColor: [255, 255, 255],
  },
  title: {
    text: "My title",
    font: 20,
  },
  watermark: "My watermark",
});
```

## API

### rrdtool

#### `create<D>(filename: string, definitions: RrdtoolDefinition[], options?: RrdToolCreateOptions): Promise<RrdtoolDatabase<D>>`

Creates a new database.
 - `filename`: Path where to save the database
 - `definitions`: Configure the data sources and the round-robin archives
 - `options`: Options
See https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html

#### `open<D>(filename: string): RrdtoolDatabase<D>`

Loads an existing database.
 - `filename`: Path to the db

#### `graph(definitions: string[], options?: RrdToolGraphOptions): Promise<RrdToolGraphInfo>`

Creates a new database.
 - `definitions`: Configure variable definitions among other things
 - `options`: Options
See https://oss.oetiker.ch/rrdtool/doc/rrdgraph.en.html

#### `now()`

Returns the current unix timestamp

### RrdtoolDatabase<D>

#### `.update(values: Partial<D>, options?: RrdToolUpdateOptions`

Insert data into the database.
 - `values`: The values to insert
 - `options`: Options
See https://oss.oetiker.ch/rrdtool/doc/rrdupdate.en.html

#### `.fetch(cf: ConsolidationFunction, options?: RrdToolFetchOptions): Promise<RrdtoolDatapoint<D>[]>`

Fetch data from the database.
 - `cf`: Consolidation function
 - `options`: Options
See https://oss.oetiker.ch/rrdtool/doc/rrdfetch.en.html

#### `.info(): Promise<RrdtoolInfo[]>` and `.dump(): Promise<string>`

Get various data from database.
See https://oss.oetiker.ch/rrdtool/doc/rrdinfo.en.html
and https://oss.oetiker.ch/rrdtool/doc/rrddump.en.html
