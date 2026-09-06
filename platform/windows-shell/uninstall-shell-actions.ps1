$ErrorActionPreference = 'Stop'
$extensions = @('.md', '.markdown', '.mdown', '.mkd')
foreach ($ext in $extensions) {
  $cascade = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\MarkdownViewer"
  Remove-Item -LiteralPath $cascade -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath 'HKCU:\Software\Classes\MarkdownViewer.SystemActions' -Recurse -Force -ErrorAction SilentlyContinue

if (-not ('MarkdownViewer.ShellNotify' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
namespace MarkdownViewer {
  public static class ShellNotify {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
  }
}
'@
}
[MarkdownViewer.ShellNotify]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host 'Removed Markdown Viewer shell actions.'
