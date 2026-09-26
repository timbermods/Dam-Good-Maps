import { readFile, writeFile } from 'node:fs/promises';
const lines=(await readFile('../landscapes/anchors.csv','utf8')).trim().split(/\r?\n/).slice(1),counts={},places=[];
for(const l of lines){const [family,name,lat,lon]=l.split(',');counts[family]=(counts[family]||0)+1;if(counts[family]<=2)places.push({family,name,lat:+lat,lon:+lon});}
places.push(
  {family:'plain',name:'Kansas prairie',lat:38.5,lon:-98.5},
  {family:'plain',name:'Dutch polder',lat:52.5,lon:5.5},
  {family:'plain',name:'Ganges plain',lat:25.5,lon:83},
  {family:'desert',name:'Sahara dunes',lat:24.5,lon:9.5},
  {family:'ocean',name:'Central Pacific control',lat:0,lon:-140},
  {family:'ice',name:'Greenland ice sheet',lat:72,lon:-40},
  {family:'polar',name:'Svalbard valley',lat:78.22,lon:15.65},
  {family:'polar',name:'Antarctic Dry Valleys',lat:-77.5,lon:162.1},
  {family:'dateline',name:'Taveuni dateline',lat:-16.82,lon:179.99},
  {family:'city',name:'Kathmandu valley',lat:27.7,lon:85.32}
);
await writeFile('places.json',JSON.stringify(places.map((p,i)=>({id:i+1,...p})),null,2));
