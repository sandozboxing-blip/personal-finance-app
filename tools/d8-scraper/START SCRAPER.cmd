@echo off
cd /d "%~dp0"
title Digital Eight Google Business Scraper
if not exist "node_modules" (echo Run SETUP SCRAPER.cmd first. & pause & exit /b 1)
if not exist "config.local.json" (echo Run SETUP SCRAPER.cmd first. & pause & exit /b 1)
findstr /C:"\"username\": \"\"" "config.local.json" >nul && (echo Username is empty. Run SETUP SCRAPER.cmd again. & pause & exit /b 1)
node scraper.js
pause