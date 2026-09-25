using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using Timberborn.ErrorReporting;
using UnityEngine;

namespace DGMProbe
{
    // One object for the whole launch (DontDestroyOnLoad): it writes the heartbeat, collects the game's
    // log lines for the map being played, hosts coroutines, and quits the game after a crash so the
    // runner can relaunch it for the remaining maps.
    public class ProbeHost : MonoBehaviour
    {
        public static ProbeHost Instance { get; private set; }

        private static readonly object LogLock = new object();
        private static readonly List<LogLine> PendingLog = new List<LogLine>();
        private const int MaxLogLinesPerMap = 400;
        private static int _logLinesThisMap;

        private float _nextHeartbeat;
        private float _smoothedFrame = 0.016f;
        private float _launchTime;
        private bool _crashed;

        private void Awake()
        {
            Instance = this;
            _launchTime = Time.realtimeSinceStartup;
            Application.logMessageReceivedThreaded += OnLog;
            ExceptionListener.FirstUncaughtException += OnFirstUncaughtException;
            // Keep running when the window is in the background (in memory only; the setting is untouched).
            Application.runInBackground = true;
        }

        private void OnDestroy()
        {
            Application.logMessageReceivedThreaded -= OnLog;
            ExceptionListener.FirstUncaughtException -= OnFirstUncaughtException;
        }

        private void Update()
        {
            _smoothedFrame = Mathf.Lerp(_smoothedFrame, Time.unscaledDeltaTime, 0.1f);
            // Silent while the probe plays (in memory; the game's volume settings are untouched).
            AudioListener.volume = 0f;
            if (Time.realtimeSinceStartup >= _nextHeartbeat)
            {
                _nextHeartbeat = Time.realtimeSinceStartup + Mathf.Max(0.5f, Probe.Job.Settings.HeartbeatSeconds);
                WriteHeartbeat();
            }
        }

        public static void ResetLogForMap()
        {
            lock (LogLock)
            {
                PendingLog.Clear();
                _logLinesThisMap = 0;
            }
        }

        // Moves the log lines gathered since the last call into the current result.
        public static void FlushLog(MapResult result)
        {
            lock (LogLock)
            {
                if (result != null)
                {
                    result.Log.AddRange(PendingLog);
                }
                PendingLog.Clear();
            }
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type == LogType.Log || condition.StartsWith(Probe.Tag, StringComparison.Ordinal))
            {
                return;
            }
            lock (LogLock)
            {
                if (_logLinesThisMap >= MaxLogLinesPerMap)
                {
                    return;
                }
                _logLinesThisMap++;
                PendingLog.Add(new LogLine
                {
                    RealTime = DateTime.UtcNow.ToString("o"),
                    Type = type.ToString(),
                    Message = condition,
                    Stack = type == LogType.Exception || type == LogType.Error ? Truncate(stackTrace, 4000) : null,
                });
            }
        }

        private static string Truncate(string s, int n) => s == null || s.Length <= n ? s : s.Substring(0, n);

        private void OnFirstUncaughtException(object sender, EventArgs e)
        {
            if (_crashed)
            {
                return;
            }
            _crashed = true;
            Probe.Phase = "crashed";
            try
            {
                MapResult r = Probe.Current;
                if (r != null && Probe.MapInProgress)
                {
                    FlushLog(r);
                    r.Status = "failed";
                    r.Failure = "The game stopped with an uncaught exception (see the log).";
                    r.EndedAt = Probe.Now();
                    Probe.WriteText(Probe.ResultPath(r.MapId), Probe.ToJson(r));
                    Probe.MapInProgress = false;
                }
                WriteHeartbeat();
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning(Probe.Tag + "could not record the crash: " + ex);
            }
            StartCoroutine(QuitSoon());
        }

        private IEnumerator QuitSoon()
        {
            // Let the crash screen write its error report first.
            yield return new WaitForSecondsRealtime(6f);
            Probe.Log("quitting after a crash");
            Application.Quit();
        }

        public void WriteHeartbeat()
        {
            try
            {
                JobMap map = Probe.CurrentMap;
                var beat = new
                {
                    pid = Process.GetCurrentProcess().Id,
                    at = Probe.Now(),
                    realSeconds = Time.realtimeSinceStartup - _launchTime,
                    phase = Probe.Phase,
                    runId = Probe.Job.RunId,
                    mapIndex = Probe.MapIndex,
                    mapId = map?.Id,
                    mapCount = Probe.Job.Maps.Count,
                    day = Probe.Day,
                    tick = Probe.Tick,
                    speed = Probe.Speed,
                    timeScale = Time.timeScale,
                    fps = _smoothedFrame > 0 ? 1f / _smoothedFrame : 0f,
                    shots = Probe.ShotsTaken,
                };
                Probe.WriteText(Path.Combine(Probe.Home, "heartbeat.json"), Probe.ToJson(beat));
            }
            catch (Exception)
            {
                // A heartbeat that fails once is retried on the next beat.
            }
        }
    }
}
