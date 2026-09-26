using System;
using Timberborn.ModManagerScene;
using UnityEngine;

namespace DGMProbe
{
    // Runs once per launch, in the mod manager scene. Without Documents\Timberborn\DGMProbe\job.json it
    // does nothing at all: no object is created, and the configurators bind nothing.
    public class ProbeStarter : IModStarter
    {
        public void StartMod(IModEnvironment modEnvironment)
        {
            try
            {
                if (!Probe.TryActivate())
                {
                    return;
                }
                Probe.Log($"job {Probe.Job.RunId}: {Probe.Job.Maps.Count} maps; results in {Probe.ResultsDir}");
                GameObject host = new GameObject("DGMProbeHost");
                UnityEngine.Object.DontDestroyOnLoad(host);
                host.AddComponent<ProbeHost>();
            }
            catch (Exception e)
            {
                Debug.LogWarning(Probe.Tag + "could not start; the game runs unmodified. " + e);
            }
        }
    }
}
