
# rrdtool.ts

This is a wrapper for `rrdtool` written in TypeScript. Inspired by the `rrdtool` NPM package https://github.com/LinusU/node-rrdtool.

## Usage

```ts
import rrdtool from "rrdtool.ts";

const start = rrdtool.now() - 10;
const db = await rrdtool.create("test.rrd", { start, step: 1 }, [
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

db.fetch("AVERAGE", start, start + 9, (err, data) => {
  if (err) { throw err; }
  console.log(data);
});
```

## API

### rrdtool

#### `.create(file, opts, args)`

Creates a new database.

 - `file`: Filename where to save the db
 - `opts`
   - `step`: Seconds between each update
   - `start`: Unix timestamp of the first data point
   - `force`: Overwrite file if it exists
 - `args`: Array of Data Sources and Round Robin Archives

#### `.open(file)`

Loads an existing database.

 - `file`: Filename of the db

#### `.now()`

Returns the current unix timestamp

### DB

#### `.update([ts, ]values[, cb])`

Insert data into the database.

 - `ts`: Unix timestamp of the data
 - `values`: Object with one entry per data source to insert into
 - `cb`: Callback to call when the data is inserted `(err)`

#### `.fetch(cf, start, stop[, res], cb)`

Fetch a span of data from the database.

 - `cf`: Consolidation function (`AVERAGE`, `MIN`, `MAX`, `LAST`)
 - `start`: Unix timestamp from where to start
 - `stop`: Unix timestamp of which to stop at
 - `res`: Resolution of the data, specified in seconds
 - `cb`: Callback to call when the data is ready `(err, data)`
