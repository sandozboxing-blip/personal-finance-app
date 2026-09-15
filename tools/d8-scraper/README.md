# Digital Eight Local Scraper

Run `SETUP SCRAPER.cmd` once, then use `START SCRAPER.cmd` for every search. Chrome stays visible. If Google displays consent or CAPTCHA, complete it manually. Before each scrape, choose an existing Leads folder or create a new one (for example `Зъболекари — София`). Results are deduplicated and saved directly into that shared folder.

`config.local.json` contains local credentials and must never be committed or shared.

Email discovery checks the official business website and up to five same-domain contact/about/team pages. It prioritizes public role-based business addresses and stores alternative public business emails in the lead details.
