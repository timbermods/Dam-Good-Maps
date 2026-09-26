/** Keep numeric preview rasters on one line; preserve all data and readable reports. */
export function compactJSON(value) {
  return JSON.stringify(value,null,2).replace(/\[\n(?:[ \t]+-?\d+(?:\.\d+)?(?:e[+-]?\d+)?,?\n)+[ \t]*\]/gi,block=>JSON.stringify(JSON.parse(block)));
}
