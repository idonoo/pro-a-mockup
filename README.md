# Pro A – Workflow Mockup (PE steel-reinforced pipe)

Next.js (App Router) full-stack mockup of the "Workflow Pro A" diagrams. Pipes only (tanks not implemented).

```bash
npm install
npm run dev      # http://localhost:3000  → pick a user on /login
```

- Data lives in `.data/db.json` (auto-seeded). Reset from Settings (executive) or delete the file.
- Logic: `src/lib/calc.ts` (BOM / cost / commission), `src/lib/workflow.ts` (status machine + stock reserve/issue), API in `src/app/api/*`.
- TH/EN toggle top-right on every page. Ø300 master weights are from the meeting example; other sizes are mock.
