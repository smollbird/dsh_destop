@echo off
rem dsh-desktop launcher: 在终端中启动桌面版（桌面快捷方式直接指向 electron.exe，无需本文件）
setlocal
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
endlocal
