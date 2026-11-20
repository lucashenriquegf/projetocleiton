@echo off
setlocal
cd /d "%~dp0web"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else if exist "%ProgramFiles%\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe" (
    set "PATH=%ProgramFiles%\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt\dependencies\node\bin;%PATH%"
  ) else (
    echo Instale o Node.js 24 LTS para iniciar este prototipo.
    pause
    exit /b 1
  )
)
if not exist "node_modules\vinext\dist\cli.js" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Instale o Node.js 24 LTS com o npm para preparar este prototipo.
    pause
    exit /b 1
  )
  echo Preparando as dependencias. A primeira execucao precisa de internet.
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)
echo.
echo Abra http://localhost:4175 no navegador.
echo Mantenha esta janela aberta enquanto usar o prototipo.
echo Para encerrar, pressione Ctrl+C.
echo.
call node node_modules\vinext\dist\cli.js dev --host 127.0.0.1 --port 4175
pause
