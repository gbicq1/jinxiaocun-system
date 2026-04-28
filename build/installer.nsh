!include "x64.nsh"
!include "WinVer.nsh"

!macro customInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
!macroend

!macro customUnInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
!macroend

Var iconPath

!macro customInstall
  StrCpy $iconPath "$INSTDIR\resources\icon.ico"
  IfFileExists "$INSTDIR\resources\icon.ico" +3
  StrCpy $iconPath "$INSTDIR\JXC Inventory System.exe"
  
  Delete "$DESKTOP\进销存管理系统.lnk"
  Delete "$SMPROGRAMS\进销存管理系统.lnk"
  CreateShortCut "$DESKTOP\进销存管理系统.lnk" "$INSTDIR\JXC Inventory System.exe" "" "$iconPath" 0
  CreateShortCut "$SMPROGRAMS\进销存管理系统.lnk" "$INSTDIR\JXC Inventory System.exe" "" "$iconPath" 0
  System::Call 'shell32::SHChangeNotify(i, i, i, i) (0x08000000, 0x1000, 0, 0)'
!macroend
