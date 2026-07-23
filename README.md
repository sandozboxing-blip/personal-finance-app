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
