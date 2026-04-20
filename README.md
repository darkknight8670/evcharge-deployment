# EV Charging P2P Dapp (Frontend + Backend + Contracts)

This repository now includes:

- Smart contracts in `contracts/` (User registry + unified charging escrow)
- Backend API in `backend/` (Express + ethers integration)
- Frontend app in `frontend/` (Next.js pages router)

## Run

1. Install root dependencies:

	`npm install`

2. Install frontend dependencies:

	`cd frontend && npm install`

3. Start backend + frontend together:

	`cd .. && npm run dev`

4. Open frontend:

	`http://localhost:3000`

5. Backend health:

	`http://localhost:4000/api/health`

## Frontend route structure

```
pages/
├── index.jsx                     → /
├── login.jsx                     → /login
├── dashboard.jsx                 → /dashboard
├── receiver/
│   ├── dashboard.jsx             → /receiver/dashboard
│   ├── broadcast.jsx             → /receiver/broadcast
│   ├── waiting.jsx               → /receiver/waiting
│   ├── session/[id].jsx          → /receiver/session/:id
│   └── complete.jsx              → /receiver/complete
├── donor/
│   ├── dashboard.jsx             → /donor/dashboard
│   ├── feed.jsx                  → /donor/feed
│   ├── confirm/[id].jsx          → /donor/confirm/:id
│   ├── session/[id].jsx          → /donor/session/:id
│   └── complete.jsx              → /donor/complete
├── history.jsx                   → /history
├── profile.jsx                   → /profile
└── error.jsx                     → /error
```

## Contract merge/integration notes

- Backend reads addresses from `Addresses.json`.
- Backend reads ABIs from Hardhat artifacts generated from:
  - `contracts/EVChargingEscrow.sol`
  - `contracts/VehicleRegistry.sol`
- Frontend writes transactions through MetaMask using backend-provided contract config.

