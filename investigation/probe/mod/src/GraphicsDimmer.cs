using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace DGMProbe
{
    // Lower rendering cost while the probe runs time fast, and put it back for screenshots and at the end
    // of each map. Everything is changed in memory only (the render pipeline asset and Unity's frame
    // settings); the game's settings, which live in the registry, are never touched.
    public static class GraphicsDimmer
    {
        private static bool _dimmed;
        private static float _renderScale;
        private static int _vSync;
        private static int _targetFrameRate;

        private static UniversalRenderPipelineAsset Asset => QualitySettings.renderPipeline as UniversalRenderPipelineAsset;

        public static void Dim()
        {
            if (_dimmed || !Probe.Job.Settings.LowGraphics)
            {
                return;
            }
            UniversalRenderPipelineAsset asset = Asset;
            _renderScale = asset != null ? asset.renderScale : 1f;
            _vSync = QualitySettings.vSyncCount;
            _targetFrameRate = Application.targetFrameRate;
            if (asset != null)
            {
                asset.renderScale = 0.5f;
            }
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = 30;
            _dimmed = true;
        }

        public static void Restore()
        {
            if (!_dimmed)
            {
                return;
            }
            UniversalRenderPipelineAsset asset = Asset;
            if (asset != null)
            {
                asset.renderScale = _renderScale;
            }
            QualitySettings.vSyncCount = _vSync;
            Application.targetFrameRate = _targetFrameRate;
            _dimmed = false;
        }
    }
}
