# Olef Cloud on restricted networks

[← README](../README.md)

Olef Cloud needs **only outbound HTTPS (TCP 443)**. No UDP, no other
ports, nothing inbound. SSH, port forwards, the device viewer and previews
all ride HTTPS or WebSockets over TLS on 443.

## Hosts to allow

| Host | Used for | Needed |
| --- | --- | --- |
| `api.olef.dev` | Sign-in, workspaces, sessions | Always |
| `connect.olef.dev` | The session tunnel (commands, sync, SSH, forwards) | Always |
| `view.olef.dev` and `*.view.olef.dev` | The live device viewer | For the viewer |
| `olef.site` and `*.olef.site` | Browser previews of a workspace's web apps | For previews |
| `mcp.olef.dev` | The hosted MCP server (Claude, ChatGPT) | For the hosted MCP |
| `app.olef.dev` | The web app | In a browser |

Browsers also load Google sign-in for the web app (`accounts.google.com`,
`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`).

## Proxies

The CLI honors `HTTPS_PROXY` (or `ALL_PROXY`) and `NO_PROXY`, in upper or
lower case:

```bash
export HTTPS_PROXY=http://proxy.example.com:3128
export HTTPS_PROXY=http://user:password@proxy.example.com:3128   # Basic auth
export NO_PROXY=localhost,.internal.example.com
```

- The proxy must allow HTTP `CONNECT` to the hosts above on port 443.
  Olef's TLS runs inside the `CONNECT`, end to end.
- Proxies or security products that inspect TLS break the tunnel's
  WebSocket and its certificate checks. Exempt the hosts above from TLS
  inspection.
- A long command survives a proxy restart: the tunnel reconnects and the
  command keeps running in the cloud.

## Checking

```bash
olef cloud doctor
```

Its `network` check tries each host on 443 and reports whether it went
direct or through the proxy, how long it took, and for a host it couldn't
reach, what's in the way (no route, the proxy refused, or TLS rewritten by
an inspecting proxy) and what to ask your network admin for.
