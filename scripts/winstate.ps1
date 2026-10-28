$procs = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
$procs | Select-Object Id,@{n='WS_MB';e={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class W {
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
 public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 public static List<string> List(HashSet<uint> pids){ var r=new List<string>(); EnumWindows(delegate(IntPtr h, IntPtr l){ uint p; GetWindowThreadProcessId(h, out p); if(pids.Contains(p) && IsWindowVisible(h)){ var sb=new StringBuilder(256); GetWindowText(h, sb, 256); r.Add(p.ToString()+"|"+h.ToString()+"|"+sb.ToString()); } return true; }, IntPtr.Zero); return r; }
}
"@
$set = New-Object 'System.Collections.Generic.HashSet[uint32]'
foreach($p in $procs){ [void]$set.Add([uint32]$p.Id) }
Write-Output "VISIBLE_WINDOWS (pid|hwnd|title):"
[W]::List($set)
