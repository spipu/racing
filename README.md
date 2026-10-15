# Spipu-Racing

Jeu de course PWA reprenant Virtua Racing Deluxe (Sega 32X). Projet personnel, non diffusé : les données du jeu d'origine (© SEGA 1994) ne doivent pas être redistribuées. Le jeu est gratuit et à but non lucratif : toute exploitation commerciale, directe ou indirecte (vente, location, publicité, abonnement, dons ou toute autre forme de rémunération), est interdite.

## Le jeu

- **Course contre la montre** : seul sur le circuit, sur les cinq circuits de l'original (Big Forest, Bay Bridge, Acropolis, Highland, Sand Park) et leurs variantes miroir, avec les trois voitures (Formula, Stock, Prototype) en boîte automatique ou manuelle ; de 5 à 50 tours.
- **Fidèle à l'original** : modèles, couleurs, ciels, physique, collisions, caméras et bruitages repris de la ROM, en haute définition et à la cadence de l'écran.
- **Déroulé d'une course** : départ des stands avec les mécaniciens à Big Forest, aux feux ailleurs ; temps des tours, écarts au record aux points de passage, messages de tour, contresens ; arrivée suivie des résultats (temps de chaque tour, meilleur tour, temps total, nouveaux records).
- **Dégâts et stands** : un choc frontal à pleine vitesse abîme la voiture ; à Big Forest, Acropolis et Highland, un arrêt aux stands la répare, avec les mécaniciens animés.
- **HUD moderne** : compte-tours, vitesse en km/h ou mph, rapport, tours, record et temps des derniers tours.
- **Quatre vues** : cockpit avec volant et bras du pilote, poursuite rapprochée, poursuite éloignée, vue haute.
- **Son** : bruitages et jingles de l'original, moteur synthétisé dont la hauteur suit le régime.
- **Commandes** : clavier, manette ou commandes tactiles, choisies automatiquement ou forcées, remappables dans les options.
- **Records** : meilleur tour et meilleure course gardés sur l'appareil, par circuit, variante et voiture, consultables et effaçables dans « Meilleurs tours ».
- **Menus et aide** : menu pause, options (affichage, course, son, contrôles), aide qui explique le déroulé d'une course ; en anglais, français, italien et espagnol.
- **Application installable**, utilisable hors ligne.
- À venir : carte du circuit dans le HUD, course à plusieurs en réseau.

## Arborescence

```
bench/             traces de référence du jeu d'origine, enregistrement et comparaison de la physique et de la course
├── recorder/      enregistreur de traces (frontal libretro en C pour PicoDrive)
├── scenarios/     scénarios de commandes rejoués dans le jeu d'origine
└── traces/        traces enregistrées (une ligne JSON par image, gzip)
tools/
├── export/        exporteur des données de la ROM vers website/assets/virtual_racing/
└── icon/          génération du jeu d'icônes depuis website/icon/icon.svg
website/           l'application, servie telle quelle
```

## Tester en local

```bash
python3 -m http.server 8082 --directory website
```

Puis `http://localhost:8082/`.

## Traces de référence

Prérequis, hors dépôt : dans `.source/`, la ROM `Virtua Racing Deluxe (USA).32x` (MD5 `72b1ad0f949f68da7d0a6339ecd51a3f`) et le cœur libretro de PicoDrive compilé (`.source/picodrive/picodrive_libretro.so`, `make -f Makefile.libretro`).

```bash
node bench/recordTraces.js              # tous les scénarios
node bench/recordTraces.js wall         # un scénario
```

Chaque scénario rejoue la navigation Time Attack (voiture, boîte, circuit), puis ses commandes ; la trace garde, image par image depuis le départ, l'état de la voiture du joueur et les variables globales du jeu. Une ligne `poke <adresse> <mot>` écrit dans la RAM du jeu (la voiture placée devant les stands ou la ligne d'arrivée, des dégâts) ; la comparaison repart alors de l'état tracé. Une ligne `from load` enregistre dès le chargement de la course (avant l'intro), `block <adresse> <octets>` trace un bloc de RAM de plus, `autopilot <images>` fait conduire la voiture par le jeu d'origine sur sa trajectoire de course.

## Comparaison de la physique

```bash
node bench/comparePhysics.js                         # tous les scénarios, tick par tick
node bench/comparePhysics.js wall --ticks 50         # un scénario, ses 50 premiers ticks
node bench/comparePhysics.js --continuous --rate 3   # physique à pas variable, 3 pas par tick
```

Le mode par défaut enchaîne `RacingCarPhysics` tick par tick depuis le premier état de la trace : chaque champ qui diffère du jeu d'origine est signalé, puis recalé sur la trace. Tous les scénarios doivent sortir `identical`. Le mode `--continuous` fait rouler librement `RacingCarContinuousPhysics` et mesure l'écart de trajectoire (mètres) et de vitesse (%) ; il échoue au-delà de 1,5 m ou 2 %. Les scénarios `views` et `views_3button` servent aux transitions de caméra : ils ne sont comparés que si on les nomme ; les courses enregistrées depuis leur chargement relèvent de la comparaison de la course.

## Comparaison de la course

```bash
node bench/compareRace.js                            # les courses enregistrées depuis leur chargement
node bench/compareRace.js race_big_forest --show 1-30  # le détail de ticks choisis
```

Rejoue une course entière (départ, tours, points de passage, arrêt aux stands, arrivée) et compare tick par tick ce que le joueur voit et entend : signes du départ, feux, mécaniciens, messages, écarts aux points de passage, arrêt aux stands, stores, sons de la course, temps des tours et arrivée des résultats. Les courses enregistrées couvrent les cinq circuits et une course avec arrêt aux stands ; toutes doivent sortir `identical`.

## Données du jeu d'origine

```bash
node tools/export/exportVirtualRacing.js     # ROM USA dans .source/, voir website/assets/virtual_racing/README.md
node tools/export/recordJingles.js           # jingles FM enregistrés depuis le jeu émulé (cœur PicoDrive et ffmpeg requis)
```

## Icônes

```bash
node tools/icon/buildIcons.js                # régénère les PNG et favicon.ico depuis website/icon/icon.svg
```
