using System;
using System.Collections;
using System.Reflection;
using Timberborn.CoreUI;

namespace DGMProbe
{
    // A panel that pauses the game (the loading-issues panel, the game-over box, any unexpected dialog)
    // would stop an unattended run. The probe records it and closes it, as a player would with its close or
    // continue button: PanelStack.Pop, which also lifts the speed lock.
    public class PanelCloser
    {
        private static readonly FieldInfo StackField = typeof(PanelStack).GetField("_stack", BindingFlags.Instance | BindingFlags.NonPublic);

        private readonly PanelStack _panelStack;

        public PanelCloser(PanelStack panelStack)
        {
            _panelStack = panelStack;
        }

        // Returns the type name of the panel it closed, or null.
        public string CloseTopPausingPanel()
        {
            if (StackField == null || !(StackField.GetValue(_panelStack) is IEnumerable stack))
            {
                return null;
            }
            IEnumerator e = stack.GetEnumerator();
            if (!e.MoveNext() || e.Current == null)
            {
                return null;
            }
            object top = e.Current;
            Type t = top.GetType();
            bool lockSpeed = (bool)(t.GetProperty("LockSpeed")?.GetValue(top) ?? false);
            IPanelController controller = t.GetProperty("PanelController")?.GetValue(top) as IPanelController;
            if (!lockSpeed || controller == null)
            {
                return null;
            }
            _panelStack.Pop(controller);
            return controller.GetType().FullName;
        }
    }
}
