using System.Collections.Generic;
using Timberborn.GameCycleSystem;
using Timberborn.HazardousWeatherSystem;
using Timberborn.NewGameConfigurationSystem;
using Timberborn.SingletonSystem;
using Timberborn.WeatherSystem;

namespace DGMProbe
{
    // Imposes the job's weather, one cycle at a time, through the game's own weather services. The first
    // cycle comes from the new game's settings (MenuDriver.ForcedMode). Each later cycle is set when the one
    // before it ends: GameCycleService posts CycleEndedEvent before it asks the weather services to draw the
    // next cycle, so the game draws exactly these values (ranges with equal ends, a badtide chance of 0 or 1)
    // and runs every rule of its own on them, the drought's early source ramp included.
    public class WeatherForcer : ILoadableSingleton
    {
        private readonly EventBus _eventBus;
        private readonly TemperateWeatherDurationService _temperate;
        private readonly DroughtWeather _drought;
        private readonly BadtideWeather _badtide;
        private readonly GameModeSpecService _gameModes;
        private readonly GameCycleService _cycles;
        private readonly WeatherService _weather;
        private readonly HazardousWeatherService _hazards;

        // After the job's last cycle: a long temperate stretch with no hazard.
        private static readonly Cycle Calm = new Cycle { TemperateDays = 60, Hazard = "drought", HazardDays = 0 };

        public WeatherForcer(EventBus eventBus, TemperateWeatherDurationService temperate, DroughtWeather drought, BadtideWeather badtide,
            GameModeSpecService gameModes, GameCycleService cycles, WeatherService weather, HazardousWeatherService hazards)
        {
            _eventBus = eventBus;
            _temperate = temperate;
            _drought = drought;
            _badtide = badtide;
            _gameModes = gameModes;
            _cycles = cycles;
            _weather = weather;
            _hazards = hazards;
        }

        public void Load()
        {
            _eventBus.Register(this);
        }

        private static List<Cycle> Plan => Probe.CurrentMap?.Cycles ?? new List<Cycle>();

        [OnEvent]
        public void OnCycleEnded(CycleEndedEvent e)
        {
            // Cycles are numbered from 1; the one about to start is e.Cycle + 1, the plan's entry e.Cycle.
            Cycle next = e.Cycle < Plan.Count ? Plan[e.Cycle] : Calm;
            Apply(next);
            Record($"cycle {e.Cycle} ended");
        }

        [OnEvent]
        public void OnCycleStarted(CycleStartedEvent e)
        {
            MapResult r = Probe.Current;
            if (r == null)
            {
                return;
            }
            string hazard = _hazards.CurrentCycleHazardousWeather is BadtideWeather ? "badtide" : "drought";
            r.Weather.Add(new WeatherCycle
            {
                Cycle = _cycles.Cycle,
                TemperateDays = _weather.TemperateWeatherDuration,
                Hazard = _weather.HazardousWeatherDuration > 0 ? hazard : "none",
                HazardDays = _weather.HazardousWeatherDuration,
            });
            Record($"cycle {_cycles.Cycle} started: {_weather.TemperateWeatherDuration} temperate days, then {hazard} for {_weather.HazardousWeatherDuration} days");
        }

        [OnEvent]
        public void OnHazardStarted(HazardousWeatherStartedEvent e)
        {
            Record((e.HazardousWeather is BadtideWeather ? "badtide" : "drought") + " started");
        }

        [OnEvent]
        public void OnHazardEnded(HazardousWeatherEndedEvent e)
        {
            Record((e.HazardousWeather is BadtideWeather ? "badtide" : "drought") + " ended");
        }

        // The first cycle is drawn while the game loads, before this singleton hears events: record it here.
        public void RecordFirstCycle()
        {
            MapResult r = Probe.Current;
            if (r == null || r.Weather.Count > 0)
            {
                return;
            }
            OnCycleStarted(new CycleStartedEvent(_cycles.Cycle));
        }

        public string CurrentWeather()
        {
            if (!_weather.IsHazardousWeather)
            {
                return "temperate";
            }
            return _hazards.CurrentCycleHazardousWeather is BadtideWeather ? "badtide" : "drought";
        }

        private void Apply(Cycle c)
        {
            bool badtide = c.Hazard == "badtide" && c.HazardDays > 0;
            int drought = !badtide ? c.HazardDays : 0;
            _temperate.Initialize(c.TemperateDays, c.TemperateDays);
            _drought.Initialize(drought, drought, 1f, 0);
            GameModeSpec spec = MenuDriver.ForcedMode(_gameModes.GetDefaultSpec(), c);
            _badtide.Initialize(spec);
        }

        private void Record(string what)
        {
            Probe.Current?.WeatherEvents.Add(new WeatherEvent { Day = Probe.Day, Event = what });
            Probe.Log(what);
        }
    }
}
