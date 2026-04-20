# rallyOS-hub

Real-time scoreboard system for rally events with multi-table support, PWA, and offline capabilities.

## Tech Stack

- **Client**: React + Vite + TypeScript + Tailwind
- **Server**: Node.js + Express + Socket.IO
- **PWA**: vite-plugin-pwa with service worker

## Features

- Multi-table system with waiting rooms
- Real-time scoreboard updates via Socket.IO
- PWA support for mobile installation
- Offline asset caching
- QR code generation for table access
- PIN-based authentication for referees and owners
- Undo last point functionality
- Match history tracking

## Quick Start

### Development

```bash
# Using the dev script (recommended)
./dev.sh

# Or manually:
# Terminal 1 - Server
cd server && npm install && npm run dev

# Terminal 2 - Client
cd client && npm install && npm run dev
```

The app will be available at:
- Client: http://localhost:5173
- Server: https://localhost:3000

### Production Build

```bash
cd client
npm run build
```

The built files will be in `client/dist/`.

## PWA

The client is configured as a Progressive Web App:
- Installable on mobile devices
- Works offline for static assets
- Auto-updates when new versions are released

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `create_table` | Client → Server | Create new table |
| `list_tables` | Client → Server | Get all tables |
| `join_table` | Client → Server | Join a table |
| `record_point` | Client → Server | Record a point |
| `undo_last` | Client → Server | Undo last point |
| `table_update` | Server → Client | Table state changed |
| `match_update` | Server → Client | Match state changed |

## Project Structure

```
rallyOS-hub/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── pages/
│   └── public/
├── server/           # Express + Socket.IO backend
│   └── src/
├── openspec/         # SDD documentation
└── docs/            # Additional docs
```

## License

MIT