@echo off
rem Inicia MIRA en http://localhost:8765 y abre el navegador.
cd /d "%~dp0"
set PY=
where python >nul 2>nul && set PY=python
if not defined PY ( where py >nul 2>nul && set PY=py )
if not defined PY (
  echo.
  echo No se encontro Python en este computador.
  echo Instalelo desde https://www.python.org/downloads/ marcando "Add python.exe to PATH"
  echo y vuelva a abrir este archivo.
  echo.
  pause
  exit /b 1
)
echo MIRA se esta ejecutando en http://localhost:8765
echo Deje esta ventana abierta mientras lo usa. Para terminar, cierrela.
start "" http://localhost:8765
%PY% -m http.server 8765
pause
