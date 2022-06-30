import { parseInfo } from "../util";

const str = `
 filename = "random.rrd"
 rrd_version = "0001"
 step = 300
 last_update = 955892996
 header_size = 2872
 ds[a].type = "GAUGE"
 ds[a].minimal_heartbeat = 600
 ds[a].min = NaN
 ds[a].max = NaN
 ds[a].last_ds = "UNKN"
 ds[a].value = 2.1824421548e+04
 ds[a].unknown_sec = 0
 ds[b].type = "GAUGE"
 ds[b].minimal_heartbeat = 600
 ds[b].min = NaN
 ds[b].max = NaN
 ds[b].last_ds = "UNKN"
 ds[b].value = 3.9620838224e+03
 ds[b].unknown_sec = 0
 rra[0].cf = "AVERAGE"
 rra[0].pdp_per_row = 1
 rra[0].cdp_prep[0].value = nan
 rra[0].cdp_prep[0].unknown_datapoints = 0
 rra[0].cdp_prep[1].value = nan
 rra[0].cdp_prep[1].unknown_datapoints = 0
`;

console.log(parseInfo(str));
