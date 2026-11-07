# MU Online JS (TypeScript Client)

> **thegame:** este é um fork do [afrokick/muonlinejs](https://github.com/afrokick/muonlinejs) usado no projeto thegame, um servidor de MU Online jogável no navegador para jogar com amigos.
> É um **projeto de fã, sem fins lucrativos e sem vínculo com a Webzen**, dona do MU Online.
> Servidor: [OpenMU](https://github.com/MUnique/OpenMU), rodando localmente com Docker. O cliente conecta pela porta `44405` (protocolo do cliente original), através do proxy (`bun run proxy`, porta `3000`).

[Live Demo](https://mujs.asosnovskiy.com/offline)

A modern TypeScript/Babylon.js client for **MU Online** that works out-of-the-box with the [OpenMU](https://github.com/MUnique/OpenMU) server.

## Features

- Runs directly in the browser
- Offline single-player demo
- Multiplayer support via a WebSocket ↔ TCP proxy written in **Bun**
- Packet encryption (SimpleModulus, Xor32, Xor3)
- Utility scripts for converting original MU assets to modern formats

## Prerequisites

- [Bun](https://bun.sh) ≥ v1.0

## Installation

```bash
bun install
```

## Usage

### Offline demo

```bash
bun run dev
```
Then open <http://localhost:5173/offline> in your browser.

### Multiplayer demo (requires OpenMU server)

1. Follow the [OpenMU Quick Start](https://github.com/MUnique/OpenMU/blob/master/QuickStart.md) guide to run the server.
2. Start the WebSocket ↔ TCP proxy:

   ```bash
   bun run proxy
   ```
3. Open <http://localhost:5173/> in your browser.

You should see log messages from OpenMU in the browser console.

## Project layout

```
/proxy            WebSocket ↔ TCP proxy (Bun)
/tools            Asset-conversion scripts (BMD → GLB, OZJ → JPEG, OZT → TGA, …)
/src              Game logic, packet definitions and encryption utilities
```

## Need help?

If you encounter a bug or have an idea for improvement, please open an [issue](https://github.com/afrokick/muonlinejs/issues) or submit a pull request.

## License

Distributed under the MIT License.

## Acknowledgements

- [OpenMU](https://github.com/MUnique/OpenMU) — the open-source server this client was built for
