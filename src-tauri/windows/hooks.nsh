; oneView — per-user Explorer integration + Default Apps registration.
; Tauri includes this file into the generated NSIS installer.

!define MDV_ACTIONS_KEY "Software\Classes\oneView.SystemActions\shell"
!define MDV_REGISTERED_APP "oneView"
!define MDV_CAPABILITIES_KEY "Software\Clients\oneView\Capabilities"
!define MDV_DOCUMENT_PROGID "oneView.Document"

!macro MDV_WRITE_CASCADE EXT
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\oneView" "MUIVerb" "oneView"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\oneView" "Icon" '$\"$INSTDIR\oneView.exe$\",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\oneView" "ExtendedSubCommandsKey" "oneView.SystemActions"
!macroend

!macro MDV_WRITE_ACTION KEY LABEL FLAG
  WriteRegStr HKCU "${MDV_ACTIONS_KEY}\${KEY}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "${MDV_ACTIONS_KEY}\${KEY}" "Icon" '$\"$INSTDIR\oneView.exe$\",0'
  WriteRegStr HKCU "${MDV_ACTIONS_KEY}\${KEY}\command" "" '$\"$INSTDIR\oneView.exe$\" ${FLAG} $\"%1$\"'
!macroend

!macro MDV_REGISTER_DEFAULT_CAPABILITY EXT
  WriteRegStr HKCU "${MDV_CAPABILITIES_KEY}\FileAssociations" "${EXT}" "${MDV_DOCUMENT_PROGID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Use the native 64-bit registry view for Explorer shell actions and Default Apps metadata.
  SetRegView 64

  ; Clean legacy pre-oneView registrations from v0.21.8 and earlier.
  DeleteRegKey HKCU "Software\Classes\MarkdownViewer.SystemActions"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.markdown\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdown\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mkd\shell\MarkdownViewer"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Markdown Viewer"
  DeleteRegKey HKCU "Software\Clients\Markdown Viewer"

  ; Stable secondary verbs: they survive changes to the user's default Markdown app.
  !insertmacro MDV_WRITE_CASCADE ".md"
  !insertmacro MDV_WRITE_CASCADE ".markdown"
  !insertmacro MDV_WRITE_CASCADE ".mdown"
  !insertmacro MDV_WRITE_CASCADE ".mkd"

  !insertmacro MDV_WRITE_ACTION "copy-rich" "复制为富文本" "--copy-rich"
  !insertmacro MDV_WRITE_ACTION "export-html" "导出 HTML…" "--export-html"
  !insertmacro MDV_WRITE_ACTION "print" "打印 / 导出 PDF…" "--print"

  ; Register with the Windows Default Apps platform. We only advertise capability here;
  ; Windows keeps the final default choice under user control.
  WriteRegStr HKCU "Software\RegisteredApplications" "${MDV_REGISTERED_APP}" "${MDV_CAPABILITIES_KEY}"
  WriteRegStr HKCU "Software\Clients\oneView" "" "oneView"
  WriteRegStr HKCU "Software\Clients\oneView\DefaultIcon" "" '$\"$INSTDIR\oneView.exe$\",0'
  WriteRegStr HKCU "Software\Clients\oneView\shell\open\command" "" '$\"$INSTDIR\oneView.exe$\"'
  WriteRegStr HKCU "${MDV_CAPABILITIES_KEY}" "ApplicationName" "oneView"
  WriteRegStr HKCU "${MDV_CAPABILITIES_KEY}" "ApplicationDescription" "轻量、快速的多格式文件查看器"
  WriteRegStr HKCU "Software\Classes\${MDV_DOCUMENT_PROGID}" "" "oneView Document"
  WriteRegStr HKCU "Software\Classes\${MDV_DOCUMENT_PROGID}\DefaultIcon" "" '$\"$INSTDIR\oneView.exe$\",0'
  WriteRegStr HKCU "Software\Classes\${MDV_DOCUMENT_PROGID}\shell\open\command" "" '$\"$INSTDIR\oneView.exe$\" $\"%1$\"'
  !insertmacro MDV_REGISTER_DEFAULT_CAPABILITY ".md"
  !insertmacro MDV_REGISTER_DEFAULT_CAPABILITY ".markdown"
  !insertmacro MDV_REGISTER_DEFAULT_CAPABILITY ".mdown"
  !insertmacro MDV_REGISTER_DEFAULT_CAPABILITY ".mkd"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  SetRegView 64

  ; Clean legacy pre-oneView registrations from v0.21.8 and earlier.
  DeleteRegKey HKCU "Software\Classes\MarkdownViewer.SystemActions"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.markdown\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdown\shell\MarkdownViewer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mkd\shell\MarkdownViewer"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Markdown Viewer"
  DeleteRegKey HKCU "Software\Clients\Markdown Viewer"
  DeleteRegKey HKCU "Software\Classes\oneView.SystemActions"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\oneView"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.markdown\shell\oneView"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdown\shell\oneView"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mkd\shell\oneView"

  DeleteRegValue HKCU "Software\RegisteredApplications" "${MDV_REGISTERED_APP}"
  DeleteRegKey HKCU "Software\Clients\oneView"
  DeleteRegKey HKCU "Software\Classes\${MDV_DOCUMENT_PROGID}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
