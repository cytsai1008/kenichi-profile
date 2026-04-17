@echo off
setlocal

for /f %%i in ('git rev-parse HEAD') do set COMMIT=%%i
for /f %%i in ('git rev-parse --short HEAD') do set SHORT=%%i
for /f %%i in ('git branch --show-current') do set BRANCH=%%i

echo Branch : %BRANCH%
echo Commit : %SHORT%
echo GitHub : https://github.com/cytsai1008/kenichi-profile/commit/%COMMIT%/checks
echo.

gh api repos/cytsai1008/kenichi-profile/commits/%COMMIT%/check-runs --template "{{range .check_runs}}{{.name}}: {{.status}} -> {{.conclusion}}{{if .details_url}}{{println}}  {{.details_url}}{{end}}{{println}}{{end}}"
