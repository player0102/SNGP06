# Outils de contrôle visuel

Scripts utilisés pendant le développement pour vérifier le rendu et les parcours.
Ils ne font pas partie de l'application et ne sont pas nécessaires à son exécution.

```bash
npm i --no-save jsdom puppeteer-core @sparticuz/chromium
node server/index.js &                # serveur sur :3000
node tools/qa/routes-smoke.mjs        # parcours des vues dans jsdom (aucune capture)
node tools/qa/login-smoke.mjs         # parcours de connexion dans jsdom
node tools/qa/shots.mjs               # 16 captures dans tools/qa/out/
```

Sous Linux minimal, le binaire fourni par `@sparticuz/chromium` a besoin des
bibliothèques NSS/NSPR (`libnss3`, `libnspr4`) ; les chemins peuvent être passés
via `QA_LD_LIBRARY_PATH`. `QA_BASE`, `QA_MATRICULE` et `QA_PASSWORD` permettent
de viser un autre serveur ou un autre compte.
