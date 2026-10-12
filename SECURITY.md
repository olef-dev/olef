# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report them privately through GitHub: open the
[Security tab](https://github.com/shadowdroid-dev/shadowdroid/security) and
choose **Report a vulnerability**. If you can't use GitHub, email
[contact@shadowdroid.dev](mailto:contact@shadowdroid.dev) with "Security" in the
subject.

Include the ShadowDroid version (`shadowdroid --version`), your host OS, and the
steps to reproduce. We aim to acknowledge reports within three business days.

## Supported versions

Security fixes go into the latest release. Update with `shadowdroid update` or
your package manager.

## Scope

ShadowDroid runs a network proxy, a debugger and an on-device service on
machines and devices you control. Reports about any of them are in scope,
including the local control channels, the proxy's certificate authority, and
how captured traffic and logs are stored and redacted
([security and redaction](docs/security-and-redaction.md)).
