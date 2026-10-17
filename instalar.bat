@echo off
rem Instala o WorldBox 2 como aplicativo (atalho na area de trabalho e botao de atualizar),
rem com o codigo desta pasta. Rodar de novo atualiza a instalacao. Os mundos salvos ficam.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\instalar.ps1" %*
pause
