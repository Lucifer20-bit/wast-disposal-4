$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$batchFile = "C:\Users\dell\Desktop\New folder (6)\waste-disposal-main\start-app.bat"
$shortcutPath = "$startupFolder\Waste Disposal App.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batchFile
$shortcut.WorkingDirectory = "C:\Users\dell\Desktop\New folder (6)\waste-disposal-main"
$shortcut.Description = "Start Waste Disposal App"
$shortcut.Save()

Write-Host "Startup shortcut created at: $shortcutPath"
