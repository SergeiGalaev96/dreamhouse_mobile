@echo off

set commitMsg=Update %date% %time%

echo Pushing to GIT...
echo =====================================
echo.

git add .

git diff --cached --quiet
IF %ERRORLEVEL% EQU 0 (
  echo No changes to commit
) ELSE (
  git commit -m "%commitMsg%"
  git push -u origin main
)

echo Done
pause