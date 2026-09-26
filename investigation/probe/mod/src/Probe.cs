using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using UnityEngine;

namespace DGMProbe
{
    // The probe's state for this launch. It lives in static fields, so it spans the main menu and every
    // game scene. Nothing here is active unless a job file was found at start-up.
    public static class Probe
    {
        public const string Tag = "[DGMProbe] ";

        public static bool Active { get; private set; }
        public static Job Job { get; private set; }
        public static string Home { get; private set; }
        public static string ResultsDir { get; private set; }
        public static string ShotsDir { get; private set; }

        // The map being played (-1 in the menu before the first one), and whether it has finished.
        public static int MapIndex = -1;
        public static bool MapInProgress;
        public static MapResult Current;
        public static string Phase = "starting";
        public static double Day;
        public static int Tick;
        public static float Speed;
        public static int ShotsTaken;

        private static readonly JsonSerializerSettings JsonSettings = new JsonSerializerSettings
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver(),
            NullValueHandling = NullValueHandling.Ignore,
            Formatting = Formatting.None,
        };

        public static string DocumentsTimberborn()
        {
            string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            return Path.Combine(docs, "Timberborn");
        }

        // The runner launches the game with this argument. A normal launch never has it, so a job file left
        // behind can never take over a player's own session.
        public const string LaunchArgument = "-dgmprobe";

        // Reads Documents\Timberborn\DGMProbe\job.json. Without the launch argument or the job file the
        // probe stays off for this launch.
        public static bool TryActivate()
        {
            if (Array.IndexOf(Environment.GetCommandLineArgs(), LaunchArgument) < 0)
            {
                return false;
            }
            Home = Path.Combine(DocumentsTimberborn(), "DGMProbe");
            string jobFile = Path.Combine(Home, "job.json");
            if (!File.Exists(jobFile))
            {
                return false;
            }
            Job = JsonConvert.DeserializeObject<Job>(File.ReadAllText(jobFile, Encoding.UTF8), JsonSettings);
            if (Job == null || Job.Maps == null || Job.Maps.Count == 0)
            {
                Log("job.json has no maps; the probe stays off.");
                return false;
            }
            ResultsDir = Path.Combine(Home, "results", Job.RunId);
            ShotsDir = Path.Combine(Home, "shots", Job.RunId);
            Directory.CreateDirectory(ResultsDir);
            Directory.CreateDirectory(ShotsDir);
            Active = true;
            return true;
        }

        public static JobMap CurrentMap => MapIndex >= 0 && MapIndex < Job.Maps.Count ? Job.Maps[MapIndex] : null;

        // The next map that has no finished result yet (so a relaunch picks up where the last one stopped).
        public static int NextMapIndex()
        {
            for (int i = MapIndex + 1; i < Job.Maps.Count; i++)
            {
                if (!File.Exists(ResultPath(Job.Maps[i].Id)))
                {
                    return i;
                }
            }
            return -1;
        }

        public static string ResultPath(string mapId) => Path.Combine(ResultsDir, mapId + ".json");

        public static void Log(string message)
        {
            Debug.Log(Tag + message);
        }

        public static string ToJson(object value) => JsonConvert.SerializeObject(value, JsonSettings);

        // Written through a temporary file, so a reader never sees half a file.
        public static void WriteText(string path, string text)
        {
            string temp = path + ".tmp";
            File.WriteAllText(temp, text, new UTF8Encoding(false));
            if (File.Exists(path))
            {
                File.Delete(path);
            }
            File.Move(temp, path);
        }

        public static void WriteGzipJson(string path, object value)
        {
            string temp = path + ".tmp";
            using (FileStream file = File.Create(temp))
            using (GZipStream gzip = new GZipStream(file, System.IO.Compression.CompressionLevel.Optimal))
            using (StreamWriter writer = new StreamWriter(gzip, new UTF8Encoding(false)))
            {
                JsonSerializer.Create(JsonSettings).Serialize(writer, value);
            }
            if (File.Exists(path))
            {
                File.Delete(path);
            }
            File.Move(temp, path);
        }

        public static string Now() => DateTime.UtcNow.ToString("o");

        public static string SafeName(string s)
        {
            StringBuilder b = new StringBuilder();
            foreach (char c in s)
            {
                b.Append(char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '_');
            }
            return b.ToString();
        }
    }
}
