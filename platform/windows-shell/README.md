# Windows Explorer Shell Actions

v0.13 adds per-user, static cascading shell verbs for Markdown files without taking over the user's default app.

```powershell
./install-shell-actions.ps1 -AppExe "C:\Program Files\Markdown Viewer\Markdown Viewer.exe"
```

The cascade exposes only document actions that are still distinct from normal opening:

- Copy as rich text
- Export HTML
- Print / Save as PDF

Normal opening already enters the visual editor automatically for compatible Markdown, so no read/edit/source mode verbs are registered.

The registration lives under `HKCU\Software\Classes\SystemFileAssociations` so it remains available even if the user changes the default Markdown application. The reusable subcommands live under `HKCU\Software\Classes\MarkdownViewer.SystemActions`.

These are classic static verbs. On Windows 11 an unpackaged Win32 app may show them in the classic/"Show more options" menu. A future MSIX or sparse-package build can promote equivalent commands into the modern Windows 11 menu without changing the app-side `--copy-rich`, `--export-html`, etc. action protocol.
