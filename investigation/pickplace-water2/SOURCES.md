# Open elevation from a browser

## Signature-water addition (this follow-up)

Elevation still uses direct AWS Terrarium. The new water reference is **ESA WorldCover 2021 v200 class 80**, nominal 10 m global land-cover data derived from Copernicus Sentinel-1/2. Class 80 represents permanent water, not every seasonal or narrow stream. It contains no lake-bottom elevations. Antarctic/open-ocean missing tiles are unknown, not dry ground. [Official data and licence](https://esa-worldcover.org/en/data-access), [AWS registry](https://registry.opendata.aws/esa-worldcover-vito/).

WorldCover is CC BY 4.0. Its required acknowledgement and dataset citation are included in [ATTRIBUTION.md](ATTRIBUTION.md), the page, preview sheets and each map. It is not Google data. Native pixels are counted into game cells; inferred beds and simulated water are explicitly marked modifications.

The real Edge browser failed direct range fetches from all three tested official AWS endpoint forms. The same byte range succeeds through the local restricted proxy (HTTP 206, 1,024 readable bytes; about 679 ms in the recorded trial). The complete browser worker also decodes native windows successfully. [Measured URLs and results](results-signature/worldcover-cors.json). This is one connectivity test per endpoint, not a speed benchmark or SLA. No published public-bucket consumer quota was found in the registry; production must bound concurrency, cache and back off.

`water-proxy.mjs` implements the smallest required handler: one fixed public dataset/version, GET and bounded byte ranges only. It never accepts an arbitrary upstream URL. The research Node server adds a local disk cache; a same-origin Cloudflare Worker is proposed for production, **not deployed**. TIFF decoding stays in the player's worker. A map needs multiple range requests, recorded per conversion, so proxy capacity must be measured in requests and transferred bytes rather than map count. See [INTEGRATION.md](INTEGRATION.md).

The elevation-only comparison below is retained from the first investigation. Its “no proxy” conclusion applies to Terrain Tiles, not to this added reference layer.

Indicative proxy cost, checked 2026-09-26: Cloudflare Workers Free includes 100,000 requests/day with 10 ms CPU per invocation. Standard starts at $5/month, including 10 million requests and 30 million CPU-ms; excess is $0.30/million requests and $0.02/million CPU-ms. This handler streams bytes and leaves TIFF decoding to the browser; actual CPU use has not been measured on Cloudflare. No paid service or deployment was created. [Official pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Checked 25 September 2026 Pacific / 26 September UTC. Use **AWS Terrain Tiles, US bucket, Terrarium PNG**. It works directly from a browser worker. No proxy, account or key is needed. No Google elevation, imagery, basemap or geocoding is used.

## Measured access

`npm run cors` creates an ordinary headless Edge page at `http://127.0.0.1:4178`. It fetches each remote URL three times, with `mode: cors`, cache disabled, no interception and no CORS bypass. GeoTIFF requests ask for bytes 0–65535. The machine is in the user's Pacific-time environment; its physical network location was not independently verified. These are small samples, not service benchmarks.

| Source / tested endpoint | Browser result | Median elapsed | Readable bytes |
| --- | --- | ---: | ---: |
| AWS Terrarium US | 3/3 HTTP 200, CORS readable | 351 ms | 63,510 |
| AWS Terrarium EU mirror | 3/3 HTTP 403, CORS readable error | 186 ms | 263 |
| Copernicus GLO-30 on AWS | 0/3; browser fetch blocked | 555 ms to failure | none |
| Copernicus GLO-90 on AWS | 0/3; browser fetch blocked | 547 ms to failure | none |
| USGS 3DEP, 1 arcsecond TIFF | 3/3 HTTP 206, CORS readable | 72 ms | 65,536 |
| Open Topo Data SRTM30m | 0/3; browser fetch blocked | 209 ms to failure | none |

Exact URLs, browser version and individual measurements: [cors.json](results/cors.json). Copernicus returned HTTP 206 to a separate HTTP client, with no `Access-Control-Allow-Origin`; Open Topo Data returned HTTP 200 without that header. See [Copernicus headers](results/copernicus-headers.txt) and [Open Topo Data headers](results/opentopodata-headers.txt). Public access alone does not make either readable in this browser. The EU mirror failed authorization, not CORS. Do not silently switch to it.

The 3DEP probe proves a readable range, not a complete GeoTIFF decoder. Its `Content-Range` was not exposed to script. Production COG readers need a tested strategy for that. PNGs need neither TIFF decompression nor a tile catalogue. The full Terrarium conversion matrix separately tests pixel decoding, including canvas access, inside actual workers.

## Data and terms

| Dataset | Resolution and coverage | Licence and attribution | Limits and suitability |
| --- | --- | --- | --- |
| **Terrain Tiles / Mapzen** | Global mosaic. Common land source is SRTM, nominal 30 m; some countries have finer local DEMs. Canada and fallback regions can be much coarser. Sea bathymetry is about 1 arcminute. Web Mercator excludes the poles. | A mosaic of provider licences, **not one blanket licence**. Carry all provider notices from [ATTRIBUTION.md](ATTRIBUTION.md), their licence links, source URL, access date and modification statement. | No published consumer quota or SLA found in its registry/docs. Public S3, no credentials. Prototype: four requests concurrently, bounded retries, persistent tile cache. Best simple first source. |
| **Copernicus GLO-30 / GLO-90 AWS** | DSM, including vegetation/buildings. Nominal 30/90 m, latitude-dependent longitude spacing. AWS's 2021 GLO-30 collection has restricted-country gaps; GLO-90 is worldwide land. Oceans have no files. | Free public use under the Copernicus WorldDEM licence. Derived outputs need the modified-data notice naming DLR, Airbus, EU and ESA, plus the Copernicus non-liability statement; see WorldDEM-30 licence Article 6. GLO-90 uses its corresponding WorldDEM-90 notice. Attribution is not simply “Copernicus”. | No numerical public-bucket quota found. Larger COG blocks and decoder complexity. Tested AWS URLs need a CORS relay. Newer Copernicus releases/access routes should be evaluated separately. |
| **USGS 3DEP** | US and territories; 1 arcsecond (~30 m) tested. 1/3 arcsecond (~10 m) seamless and finer regional products exist; availability varies. Not a global solution. | USGS public-domain data. Credit USGS 3DEP, retain source metadata and describe changes. | No dataset-specific numerical S3 quota found. Useful future regional upgrade; catalogue/version selection and a COG reader are additional work. |
| **SRTM through Open Topo Data** | 1 arcsecond (~30 m), near-global land: mission coverage 60°N–56°S. Missing ocean tiles can return null. | NASA/USGS SRTM; credit USGS/NASA, retain dataset/version metadata. Original notices for redistribution outside the US are recorded in the survey attribution. The API's software licence is not the dataset licence. | Public API: 100 points/request, 1 request/s, 1,000/day. At least 656 requests for 256², before a halo or previews: about 11 minutes at the permitted rate. Needs a CORS relay at the tested endpoint. Unsuitable for raster-sized queries. |

Sources: [Terrain registry](https://registry.opendata.aws/terrain-tiles/), [provider resolutions and mosaic caveats](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md), [provider attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md); [Copernicus registry](https://registry.opendata.aws/copernicus-dem/), [AWS COG layout](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), [WorldDEM-30 licence](https://docs.sentinel-hub.com/api/latest/static/files/data/dem/resources/license/License-COPDEM-30.pdf); [USGS products](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services), [3DEP FAQ](https://www.usgs.gov/3d-elevation-program/science/faqs); [Open Topo Data quotas](https://www.opentopodata.org/), [SRTM API](https://www.opentopodata.org/datasets/srtm/), [USGS mission coverage](https://www.usgs.gov/publications/shuttle-radar-topography-mission-srtm).

Pixel spacing is not source resolution or accuracy. Increasing PNG zoom cannot recover a narrow river absent from the original DEM. Terrain Tiles is an older mosaic; it is unsuitable for claiming current infrastructure or precise shorelines. Do not infer a freshwater river, lake depth or discharge from elevation alone.

S3's [general throughput guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html) is not a consumer allocation or permission to flood a public bucket. Respect 429/503, cache, and keep concurrency modest. No rate-limit stress test was performed.

## Proxy contingency, proposal only

The chosen source needs **no proxy**, so the present server cost is **$0**. If its CORS policy changes, the smallest relay is one Cloudflare Worker: accept only `GET /terrarium/z/x/y.png`, validate integer bounds and a maximum zoom, construct one fixed upstream hostname, stream bytes, set the site's CORS origin and cache successful immutable tiles. No arbitrary URL, credentials, database or terrain computation. Bound response size, request duration and per-client rate; handle OPTIONS. Preserve provider notices in the app and exports.

For Copernicus, the same pattern would need a fixed bucket/key allowlist, single-range GET/HEAD forwarding, and exposed range headers. It must not turn a complete 40 MB object into the normal response to a tiny range request. Missing tiles must remain missing rather than silently becoming sea.

Cloudflare currently lists 100,000 free requests/day with 10 ms CPU/request. A streaming relay at 20 tile requests/map and 1,000 maps/day is 20,000 requests/day; expected $0 if it stays within those limits. Paid Workers start at $5/month, including 10 million requests and 30 million CPU-ms; extra requests are $0.30/million and CPU $0.02/million ms. This is an estimate, excluding any upstream charges, not a deployment. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/).
