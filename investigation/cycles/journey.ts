// Follow one original plant cohort through consecutive cycles, without resetting the map.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {generate} from '../../src/core/gen/generate';
import {makeSpec,THEMES} from '../../src/core/spec/mapspec';
import {schedule} from './weather';
import {CycleModel} from './model';
import {Measures,frame,rounded} from './measures';
const dir=process.cwd().endsWith('cycles')?'.':'investigation/cycles';
mkdirSync(`${dir}/results/journeys`,{recursive:true});
for(const theme of THEMES)for(const [size,seed] of [[96,1],[128,2]]) {
  const id=`${theme}-${size}-${seed}`,path=`${dir}/results/journeys/${id}.json.gz`;
  if(existsSync(path))continue;
  const r=generate(makeSpec({theme,seed,size:{x:size,y:size}}));if(!r.report.passed)throw Error(id);
  const model=new CycleModel(r.built),measure=new Measures(model,r.spec.settings.start.rules.waterWithin);
  const all=schedule('normal',1729),firstBad=all.findIndex(p=>p.weather==='badtide');
  const phases=all.slice(0,firstBad+1);phases.push({weather:'normal',days:5,cycle:phases.at(-1)!.cycle+1,occurrence:6,previous:'badtide'});
  let elapsed=0;const days:any[]=[],frames:any[]=[];const t=performance.now();
  for(const phase of phases){model.run(phase,(day,m)=>{days.push({...measure.sample(elapsed+day),phase:phase.weather,phaseDay:day,cycle:phase.cycle});frames.push(frame(m,measure.initialWet));});elapsed+=phase.days;}
  const record={id:'journey',label:'First five cycles · Normal',phases,days,frames,ms:rounded(performance.now()-t),firstWaterLost:measure.firstWaterLost,
    recoveryDays:null,deaths:model.plants.flatMap((p,k)=>p.diedAt!==null?[{plant:k,tile:p.tile,day:rounded(p.diedAt),cause:p.cause}]:[])};
  const galleryPath=`${dir}/viewer/data/${id}.json.gz`;
  const gallery=JSON.parse(gunzipSync(readFileSync(galleryPath)).toString());
  gallery.scenarios=gallery.scenarios.filter((s:any)=>s.id!=='journey');gallery.scenarios.push(record);
  writeFileSync(galleryPath,gzipSync(JSON.stringify(gallery),{level:9}));
  const {frames:_,...metrics}=record;writeFileSync(path,gzipSync(JSON.stringify({map:id,...metrics}),{level:9}));
  console.log(`${id}: ${elapsed} days, ${record.ms}ms, ${record.deaths.length} original plants lost`);
}
