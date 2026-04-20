@echo off
:: --- NHAI Dev Environment Launcher ---

:: 1. Set the Proxy
set HTTP_PROXY=http://192.168.0.142:8080
set HTTPS_PROXY=http://192.168.0.142:8080
set http_proxy=http://192.168.0.142:8080
set https_proxy=http://192.168.0.142:8080
set PYTHONIOENCODING=utf-8

:: 2. Set Git Bash Path
set CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe

:: 3. Add Claude to your PATH for this session
set PATH=set PATH=%PATH%;C:\Users\ASUS\.local\bin


:: 4. Node.js (User-level ZIP install, no admin needed)
::    FIRST TIME SETUP:
::    a) Download "Windows Binary (.zip)" from https://nodejs.org/en/download
::    b) Extract it to: %LOCALAPPDATA%\node
::    c) Make sure node.exe is directly inside that folder
set "PATH=%LOCALAPPDATA%\node;%PATH%"

:: 5. Conda - activate ai-tools-310 environment
call "C:\Users\ASUS\miniconda3\condabin\conda.bat" ai_tools_env_py3.13
call "C:\Users\ASUS\miniconda3\Scripts\activate.bat" ai_tools_env_py3.13
:: 6. Navigate to project directory
cd /d "C:\Users\ASUS\Desktop\Projects\work_tracker"

:: 7. Clear screen and show status
cls
echo =================================================
echo  NHAI Dev Environment Ready
echo  * Proxy   : 192.168.0.142:8080
echo  * Claude  : ready
echo  * Node    : %LOCALAPPDATA%\node
echo  * Conda   : ai_tools_env_py3.13
echo  * Dir     : %CD%
echo =================================================
echo.

:: 8. Keep the window open
cmd /k
