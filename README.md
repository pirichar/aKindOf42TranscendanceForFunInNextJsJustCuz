# 🏓 Pong

```
        ██████╗   ██████╗  ███╗   ██╗  ██████╗
        ██╔══██╗ ██╔═══██╗ ████╗  ██║ ██╔════╝
        ██████╔╝ ██║   ██║ ██╔██╗ ██║ ██║  ███╗
        ██╔═══╝  ██║   ██║ ██║╚██╗██║ ██║   ██║
        ██║      ╚██████╔╝ ██║ ╚████║ ╚██████╔╝
        ╚═╝       ╚═════╝  ╚═╝  ╚═══╝  ╚═════╝
```

A web remake of the classic — and my for-fun take on **ft_transcendence**,
the final project of [42](https://42.fr): an online Pong where you can play
against other people, or against an AI when nobody's around.

Built to get better at **React** — the game runs on a `<canvas>` driven by
`requestAnimationFrame`, with React managing the UI around it.

## 🚧 Status

Work in progress — the local game is being built step by step
(the full plan lives in [`todo.md`](./todo.md)):

- [x] Game court rendered on canvas (ball, paddles, net)
- [x] Game loop with `requestAnimationFrame`
- [x] Ball movement & wall bounces
- [ ] Keyboard-controlled paddle
- [ ] Paddle collisions
- [ ] Scoring
- [ ] AI opponent
- [ ] Pause / win screen
- [ ] Online multiplayer 👀

## 🕹️ Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000/pong](http://localhost:3000/pong) and enjoy.

## 🧰 Tech

- [Next.js](https://nextjs.org) (App Router)
- [React](https://react.dev) — hooks, refs, and a game loop living in `useEffect`
- HTML5 Canvas 2D API
- [Tailwind CSS](https://tailwindcss.com)

## 👤 Author

```
        ██████╗   ██╗  ██████╗
        ██╔══██╗  ██║  ██╔══██╗
        ██████╔╝  ██║  ██████╔╝
        ██╔═══╝   ██║  ██╔══██╗
        ██║       ██║  ██║  ██║
        ╚═╝       ╚═╝  ╚═╝  ╚═╝
```

**PL Richard** — [github.com/pirichar](https://github.com/pirichar)

*Made for fun. Bounces guaranteed (eventually).*
