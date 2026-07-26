# Digital Eight Panel

Shared PHP dashboard for SMM, web-design clients, leads, tasks, income, costs, and net-profit analytics.

## Server requirements

- PHP 7.4 or newer
- Apache hosting with `.htaccess` support
- Write permission for the `data` directory

## First deployment in cPanel

1. Upload the repository files to the domain's document root (usually `public_html`).
2. Copy `config.example.php` to `config.php`.
3. Edit `config.php` and replace both example passwords with strong, unique passwords.
4. Keep the `data` directory writable (`755`, or `775` if required by the host).
5. Open the domain and sign in.

`config.php` and `data/panel-data.php` are intentionally ignored by Git. Future pulls can update the application without replacing passwords or shared business data.

## Updating from GitHub

In cPanel Git Version Control, pull/deploy the latest `main` branch. Back up `data/panel-data.php` before major updates.

The exact automatic-deployment configuration depends on the cPanel account name and document-root path, so it should be configured inside cPanel rather than committed with guessed paths.

## OneSignal Web Push

The dashboard uses the OneSignal Web SDK v16 with App ID `258501b4-c99d-4ed1-92d3-3ce01d5c6242`.

1. In OneSignal, configure the Web platform with site URL `https://finance.management.digitaleight.bg`.
2. Confirm `https://finance.management.digitaleight.bg/OneSignalSDKWorker.js` returns JavaScript without a redirect.
3. Sign in to the dashboard, open Settings, and press **Включи известията**.
4. OneSignal identifies each subscription with the dashboard profile name (`Admin` or `Partner`) as its External ID.
5. On iPhone/iPad 16.4+, add the dashboard to the Home Screen and open it from the installed icon before enabling notifications.

The OneSignal App ID is public. Never commit an App API key or REST API key.