# Academy exams LaunchAgent (Bot-independent)

```bash
mkdir -p ~/StrataMesh/fog/data/logs
cp deploy/mac-fog/pt.calhegasmorais.academy-daily-exams.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/pt.calhegasmorais.academy-daily-exams.plist 2>/dev/null || launchctl load ~/Library/LaunchAgents/pt.calhegasmorais.academy-daily-exams.plist
```

Weekdays 09:00 local. Survives Grok Bot / grok.com metabol caps.
In-band: desk_ops `academy_teach_tick` on Fog TUI `r`/60s.
