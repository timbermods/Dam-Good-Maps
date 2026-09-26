import {writeFileSync} from 'node:fs';
import {loadWeather} from './weather-suite.mjs';
import {adversarialWeather} from './weather-adversarial.mjs';
const result=await adversarialWeather(await loadWeather());
writeFileSync('results/weather/boundaries-node.json',JSON.stringify(result,null,2)+'\n');
console.log('PASS weather boundary and dependency tests',result.records.length,'cases');
