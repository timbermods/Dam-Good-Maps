const $ = id => document.getElementById(id);
const names = ['Dry ground', 'Moist soil', 'Shallow clean water', 'Clean water', 'Badwater', 'Contaminated soil', 'Dried water'];
const colours = ['#817969', '#719756', '#8ed4d6', '#278ba9', '#b65348', '#ad75a7', '#d8a348'];
let data, scenario, heights, state, depth, bad, phase = 'normal', timer = null, request = 0;
const unpack = (pairs, N) => { const a = new Float64Array(N); let pos = 0; for (let i = 0; i < pairs.length; i += 2) {
    a.fill(pairs[i + 1], pos, pos + pairs[i]);
    pos += pairs[i];
} if (pos !== N)
    throw Error('Invalid map data'); return a; };
const fmt = n => Math.round(n).toLocaleString();
function stop() { clearInterval(timer); timer = null; $('play').textContent = '▶ Play'; $('play').setAttribute('aria-label', 'Play timeline'); }
function cases() {
    stop();
    const current = $('case').value;
    const list = data.scenarios.filter(s => s.id === 'journey' || (phase === 'normal' ? s.id === 'normal' : phase === 'badtide' ? s.id === 'first-badtide' : s.id.startsWith('first-') && s.id !== 'first-badtide' || s.id === 'late-hard'));
    $('case').replaceChildren(...list.map(s => new Option(s.label, s.id)));
    if (list.some(s => s.id === current))
        $('case').value = current;
    chooseCase();
}
function chooseCase() { stop(); scenario = data.scenarios.find(s => s.id === $('case').value); $('day').max = scenario.days.at(-1).day; $('day').value = 0; $('endlabel').textContent = `${scenario.days.at(-1).day} days${scenario.id === 'normal' ? '' : ' including recovery'}`; render(); }
function describe() {
    if (scenario.id === 'journey')
        return `Follow the same map through five Normal cycles, then five days of recovery. The droughts lengthen as their early help runs out. The first badtide arrives in cycle 5. This run keeps water, soil and plant deaths between cycles.`;
    const hazard = scenario.days.filter(d => d.phase !== 'normal'), end = hazard.at(-1), base = scenario.days[0];
    if (!end)
        return `Over ${scenario.phases[0].days} normal days, the map keeps ${Math.round(scenario.days.at(-1).volume / base.volume * 100)}% of its starting water.`;
    const startDay = hazard[0].day, duration = scenario.phases.find(p => p.weather !== 'normal').days;
    const loss = scenario.firstWaterLost;
    const water = loss === null ? `The start keeps reachable clean water through the whole stretch.` : loss < startDay ? `The start loses reachable clean water before the hazard begins.` : `The start loses reachable clean water by day ${Math.max(0, loss - startDay)} of the ${end.phase}.`;
    const effect = end.phase === 'drought' ? `This ${duration}-day drought dries ${fmt(end.driedTiles)} water tiles and leaves ${Math.round(end.volume / base.volume * 100)}% of the starting water.` : `This ${duration}-day badtide leaves ${fmt(Math.max(0, end.badTiles - base.badTiles))} more water tiles and ${fmt(Math.max(0, end.soilTiles - base.soilTiles))} more soil tiles contaminated.`;
    const recovery = scenario.recoveryDays === null ? 'Recovery is still incomplete when this stretch ends.' : `Water, moisture and the clean-water area recover in ${scenario.recoveryDays} ${scenario.recoveryDays === 1 ? 'day' : 'days'}.`;
    return `${effect} ${water} ${recovery}`;
}
function render() {
    if (!scenario)
        return;
    const selected = Number($('day').value), matches = scenario.days.map((d, i) => d.day === selected ? i : -1).filter(i => i >= 0), ix = matches.find(i => scenario.days[i].phase !== 'normal') ?? matches[0], day = scenario.days[ix], f = scenario.frames[ix], N = data.size ** 2;
    state = unpack(f.state, N);
    depth = unpack(f.depth, N);
    bad = unpack(f.bad, N);
    $('daylabel').textContent = `${scenario.id === 'journey' ? `Cycle ${day.cycle} · ` : ''}${day.phase === 'normal' && scenario.id !== 'journey' && scenario.days.slice(0, ix).some(d => d.phase !== 'normal') ? 'Recovery' : day.phase[0].toUpperCase() + day.phase.slice(1)} · day ${day.phaseDay}`;
    $('water').textContent = `${fmt(day.volume)} m³`;
    $('soil').textContent = fmt(day.soilTiles);
    $('food').textContent = fmt(day.plants.nearBushesAlive);
    $('wood').textContent = fmt(day.plants.nearTreesAlive);
    $('summary').textContent = describe();
    $('scope').textContent = `${scenario.id === 'journey' ? 'This is one continuous run.' : scenario.id === 'normal' ? 'This starts from the settled map.' : 'Each weather probe starts from the same settled map. Drought includes one day of falling source flow, then recovery.'} Dead trees still leave ${fmt(day.plants.nearLogs)} potential logs near the start.`;
    const c = $('terrain'), ctx = c.getContext('2d'), scale = c.width / data.size;
    const maxH = Math.max(...heights);
    for (let y = 0; y < data.size; y++)
        for (let x = 0; x < data.size; x++) {
            const i = y * data.size + x;
            ctx.fillStyle = colours[state[i]];
            ctx.fillRect(x * scale, (data.size - 1 - y) * scale, Math.ceil(scale), Math.ceil(scale));
            if (state[i] === 0) {
                ctx.fillStyle = `rgba(255,250,220,${heights[i] / maxH * .32})`;
                ctx.fillRect(x * scale, (data.size - 1 - y) * scale, Math.ceil(scale), Math.ceil(scale));
            }
        }
    if ($('plants').checked) {
        const dead = new Set(f.dead);
        data.plants.forEach((p, k) => {
            const x = (p.tile % data.size + .5) * scale, y = (data.size - .5 - Math.floor(p.tile / data.size)) * scale;
            ctx.strokeStyle = dead.has(k) ? '#792f22' : '#203f32';
            ctx.fillStyle = ctx.strokeStyle;
            if (dead.has(k)) {
                ctx.beginPath();
                ctx.moveTo(x - 1.5, y - 1.5);
                ctx.lineTo(x + 1.5, y + 1.5);
                ctx.moveTo(x + 1.5, y - 1.5);
                ctx.lineTo(x - 1.5, y + 1.5);
                ctx.stroke();
            }
            else {
                ctx.beginPath();
                ctx.arc(x, y, p.species === 'BlueberryBush' ? 1.2 : 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    const sx = (data.start.x + .5) * scale, sy = (data.size - .5 - data.start.y) * scale;
    ctx.strokeStyle = '#fffce5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f3cf51';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    $('regions').replaceChildren(...data.regions.filter(r => r.tiles >= 8).sort((a, b) => b.initialVolume - a.initialVolume).map(r => { const tr = document.createElement('tr'); for (const v of [r.name, `${fmt(day.regionVolume[r.id])} m³`, `${Math.round(day.regionVolume[r.id] / r.initialVolume * 100)}%`]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.append(td);
    } return tr; }));
    $('changes').textContent = day.splitBodies ? `${day.splitBodies} original water ${day.splitBodies === 1 ? 'body has' : 'bodies have'} split. The largest split leaves ${day.maxFragments} connected pools, including tiny pools.` : 'No original water body has split into separate pools on this day.';
    const chart = $('chart'), g = chart.getContext('2d'), pad = 15, max = Math.max(...scenario.days.map(d => d.volume)) * 1.1;
    g.clearRect(0, 0, chart.width, chart.height);
    for (const [key, colour] of [['volume', '#278ba9'], ['badVolume', '#b65348']]) {
        g.strokeStyle = colour;
        g.lineWidth = 2;
        g.beginPath();
        scenario.days.forEach((d, i) => { const x = pad + d.day / scenario.days.at(-1).day * (chart.width - pad * 2), y = chart.height - pad - d[key] / max * (chart.height - pad * 2); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
    }
    const x = pad + day.day / scenario.days.at(-1).day * (chart.width - pad * 2);
    g.strokeStyle = '#24332d';
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, chart.height);
    g.stroke();
}
async function load() {
    stop();
    const id = $('map').value, token = ++request;
    $('loading').hidden = false;
    $('loading').textContent = 'Loading this map…';
    try {
        const res = await fetch(`data/${id}.json.gz`);
        if (!res.ok)
            throw Error(`Map could not load (${res.status})`);
        const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
        if (token !== request)
            return;
        data = JSON.parse(text);
        heights = unpack(data.heights, data.size ** 2);
        $('mapmeta').textContent = `${data.size} × ${data.size} · seed ${data.seed}`;
        $('loading').hidden = true;
        cases();
    }
    catch (e) {
        $('loading').textContent = e.message;
    }
}
document.querySelectorAll('[data-phase]').forEach(button => button.onclick = () => { phase = button.dataset.phase; document.querySelectorAll('[data-phase]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); if (data)
    cases(); });
$('map').onchange = load;
$('case').onchange = chooseCase;
$('day').oninput = () => { stop(); render(); };
$('plants').onchange = render;
$('play').onclick = () => { if (timer) {
    stop();
    return;
} if (!scenario)
    return; if (Number($('day').value) >= Number($('day').max))
    $('day').value = 0; $('play').textContent = 'Ⅱ Pause'; $('play').setAttribute('aria-label', 'Pause timeline'); timer = setInterval(() => { let n = Number($('day').value) + 1; if (n > Number($('day').max)) {
    stop();
    return;
} $('day').value = n; render(); }, 650); };
$('terrain').onpointermove = e => { if (!data)
    return; const r = e.currentTarget.getBoundingClientRect(), x = Math.min(data.size - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * data.size))), y = data.size - 1 - Math.min(data.size - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * data.size))), i = y * data.size + x; $('tile').textContent = `(${x}, ${y}) · ${names[state[i]]} · water ${(depth[i] / 1000).toFixed(2)} deep · ${(bad[i] / 10).toFixed(1)}% contamination · ground ${heights[i]}`; };
try {
    const res = await fetch('manifest.json');
    if (!res.ok)
        throw Error('Run the gallery batch first.');
    const list = await res.json();
    $('map').replaceChildren(...list.map(m => new Option(`${m.name} · seed ${m.seed} · ${m.size}²`, m.id)));
    await load();
}
catch (e) {
    $('loading').textContent = e.message;
}
