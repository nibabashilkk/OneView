param(
  [Parameter(Mandatory = $true)]
  [string]$AppExe
)

$ErrorActionPreference = 'Stop'
$AppExe = [System.IO.Path]::GetFullPath($AppExe)
if (-not (Test-Path -LiteralPath $AppExe -PathType Leaf)) {
  throw "Markdown Viewer executable not found: $AppExe"
}

$extensions = @('.md', '.markdown', '.mdown', '.mkd')
$actionRoot = 'HKCU:\Software\Classes\MarkdownViewer.SystemActions\shell'
$actions = @(
  @{ Key = 'copy-rich';  Label = '复制为富文本';     Flag = '--copy-rich' },
  @{ Key = 'export-html';Label = '导出 HTML…';       Flag = '--export-html' },
  @{ Key = 'print';      Label = '打印 / 导出 PDF…'; Flag = '--print' }
)

New-Item -Path $actionRoot -Force | Out-Null
foreach ($action in $actions) {
  $verbPath = Join-Path $actionRoot $action.Key
  $commandPath = Join-Path $verbPath 'command'
  New-Item -Path $commandPath -Force | Out-Null
  New-ItemProperty -Path $verbPath -Name 'MUIVerb' -Value $action.Label -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $verbPath -Name 'Icon' -Value ('"{0}",0' -f $AppExe) -PropertyType String -Force | Out-Null
  Set-Item -Path $commandPath -Value ('"{0}" {1} "%1"' -f $AppExe, $action.Flag)
}

foreach ($ext in $extensions) {
  $cascade = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\MarkdownViewer"
  New-Item -Path $cascade -Force | Out-Null
  New-ItemProperty -Path $cascade -Name 'MUIVerb' -Value 'Markdown Viewer' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $cascade -Name 'Icon' -Value ('"{0}",0' -f $AppExe) -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $cascade -Name 'ExtendedSubCommandsKey' -Value 'MarkdownViewer.SystemActions' -PropertyType String -Force | Out-Null
}

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
Write-Host "Installed Markdown Viewer shell actions for $($extensions -join ', ')"
