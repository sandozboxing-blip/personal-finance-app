@echo off
cd /d "%~dp0"
title Digital Eight Scraper Setup
where node >nul 2>nul || (echo Install Node.js LTS from https://nodejs.org/ & pause & exit /b 1)
call npm install
if errorlevel 1 (echo Installation failed. & pause & exit /b 1)
call npx playwright install chromium
if errorlevel 1 (echo Chrome engine installation failed. & pause & exit /b 1)
node setup.js
pause
