!macro customInstall
  SetShellVarContext current
  Delete "$SMSTARTUP\Character Todo.lnk"
  CreateShortCut "$SMSTARTUP\Character Todo.lnk" "$INSTDIR\Character Todo.exe" "" "$INSTDIR\Character Todo.exe" 0
!macroend

!macro customUnInstall
  SetShellVarContext current
  Delete "$SMSTARTUP\Character Todo.lnk"
!macroend
