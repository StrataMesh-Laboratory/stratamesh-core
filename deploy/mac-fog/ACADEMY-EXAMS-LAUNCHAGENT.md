# Academy exams LaunchAgent (Bot-independent)

Mac Fog **primary backup** when desk `r`/60s already covers in-band ticks.

```bash
mkdir -p ~/StrataMesh/fog/data/logs
cp deploy/mac-fog/pt.calhegasmorais.academy-daily-exams.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/pt.calhegasmorais.academy-daily-exams.plist 2>/dev/null \
  || launchctl load ~/Library/LaunchAgents/pt.calhegasmorais.academy-daily-exams.plist
```

Weekdays 09:00 local → `ops/bin/academy-exams-tick.sh` → `academy_exams.py --tick`.

Survives Grok Bot / grok.com metabol caps. In-band primary remains `desk_ops` `academy_teach_tick` on Fog TUI `r`/60s.
