/**
 * Every user-facing text of Spipu-Racing, served by AppTranslator.
 *
 * Proper nouns are not translated (the brand, course and car names, language
 * autonyms, units).
 */
class RacingTranslations {
    static get CATALOG() {
        return {
            // --- Main menu ---
            'menu.main': {
                fr: 'Menu principal',
                en: 'Main menu',
                it: 'Menu principale',
                es: 'Menú principal'
            },
            'menu.bestLaps': {
                fr: 'Meilleurs tours',
                en: 'Best laps',
                it: 'Giri migliori',
                es: 'Mejores vueltas'
            },
            'records.resetAll': {
                fr: 'Tout réinitialiser',
                en: 'Reset all',
                it: 'Reimposta tutto',
                es: 'Restablecer todo'
            },
            'records.resetAllConfirm': {
                fr: 'Effacer tous les meilleurs temps enregistrés ?',
                en: 'Clear every saved best time?',
                it: 'Cancellare tutti i migliori tempi salvati?',
                es: '¿Borrar todos los mejores tiempos guardados?'
            },
            'records.resetCourse': {
                fr: 'Réinitialiser ce circuit',
                en: 'Reset this course',
                it: 'Reimposta questo circuito',
                es: 'Restablecer este circuito'
            },
            'records.resetCourseConfirm': {
                fr: 'Effacer les meilleurs temps\nde {course} ?',
                en: 'Clear the best times\nof {course}?',
                it: 'Cancellare i migliori tempi\ndi {course}?',
                es: '¿Borrar los mejores tiempos\nde {course}?'
            },
            'records.course': {
                fr: 'Circuit',
                en: 'Course',
                it: 'Circuito',
                es: 'Circuito'
            },
            'records.failed': {
                fr: 'Impossible de lire ou d’effacer les meilleurs temps.',
                en: 'The best times could not be read or cleared.',
                it: 'Impossibile leggere o cancellare i tempi migliori.',
                es: 'No se pudieron leer ni borrar los mejores tiempos.'
            },
            'menu.newRace': {
                fr: 'Nouvelle course',
                en: 'New race',
                it: 'Nuova gara',
                es: 'Nueva carrera'
            },
            'menu.course': {
                fr: 'Choix du circuit',
                en: 'Course select',
                it: 'Scelta del circuito',
                es: 'Elección del circuito'
            },
            'menu.car': {
                fr: '{course} — Choix de la voiture',
                en: '{course} — Car select',
                it: '{course} — Scelta della vettura',
                es: '{course} — Elección del coche'
            },
            'course.mirror': {
                fr: '{course} — miroir',
                en: '{course} — mirrored',
                it: '{course} — specchiato',
                es: '{course} — espejo'
            },
            'car.gearbox': {
                fr: 'Boîte de vitesses',
                en: 'Transmission',
                it: 'Cambio',
                es: 'Caja de cambios'
            },
            'value.gearbox.automatic': {
                fr: 'Automatique',
                en: 'Automatic',
                it: 'Automatico',
                es: 'Automática'
            },
            'value.gearbox.manual': {
                fr: 'Manuelle',
                en: 'Manual',
                it: 'Manuale',
                es: 'Manual'
            },
            'menu.options': {
                fr: 'Options',
                en: 'Options',
                it: 'Opzioni',
                es: 'Opciones'
            },
            'menu.help': {
                fr: 'Aide',
                en: 'Help',
                it: 'Aiuto',
                es: 'Ayuda'
            },
            'menu.storageUnavailable': {
                fr: 'Stockage navigateur indisponible — les paramétrages ne seront pas enregistrés.',
                en: 'Browser storage unavailable — the settings will not be saved.',
                it: 'Archiviazione del browser non disponibile — le impostazioni non verranno salvate.',
                es: 'Almacenamiento del navegador no disponible — los ajustes no se guardarán.'
            },
            'menu.catalogUnavailable': {
                fr: 'Impossible de lire la liste des circuits et des voitures.',
                en: 'The list of the courses and cars could not be read.',
                it: 'Impossibile leggere l’elenco dei circuiti e delle vetture.',
                es: 'No se pudo leer la lista de circuitos y coches.'
            },
            // --- Options ---
            'options.display': {
                fr: 'Affichage',
                en: 'Display',
                it: 'Visualizzazione',
                es: 'Pantalla'
            },
            'options.race': {
                fr: 'Course',
                en: 'Race',
                it: 'Gara',
                es: 'Carrera'
            },
            'options.sound': {
                fr: 'Son',
                en: 'Sound',
                it: 'Audio',
                es: 'Sonido'
            },
            'options.multiplayer': {
                fr: 'Multijoueur',
                en: 'Multiplayer',
                it: 'Multigiocatore',
                es: 'Multijugador'
            },
            'settings.controls.device': {
                fr: 'Appareil',
                en: 'Device',
                it: 'Dispositivo',
                es: 'Dispositivo'
            },
            'device.automatic': {
                fr: 'Automatique',
                en: 'Automatic',
                it: 'Automatico',
                es: 'Automático'
            },
            'device.auto': {
                fr: 'Automatique : {device}',
                en: 'Automatic: {device}',
                it: 'Automatico: {device}',
                es: 'Automático: {device}'
            },
            'device.keyboard': {
                fr: 'Clavier',
                en: 'Keyboard',
                it: 'Tastiera',
                es: 'Teclado'
            },
            'device.gamepadAny': {
                fr: 'Manette',
                en: 'Gamepad',
                it: 'Controller',
                es: 'Mando'
            },
            'device.gamepad': {
                fr: 'Manette ({name})',
                en: 'Gamepad ({name})',
                it: 'Controller ({name})',
                es: 'Mando ({name})'
            },
            'device.virtualPad': {
                fr: 'Commandes tactiles',
                en: 'Touch controls',
                it: 'Comandi touch',
                es: 'Controles táctiles'
            },
            'options.controls': {
                fr: 'Contrôles',
                en: 'Controls',
                it: 'Comandi',
                es: 'Controles'
            },
            'options.reset': {
                fr: 'Réinitialiser tous les paramétrages',
                en: 'Reset every setting',
                it: 'Reimposta tutte le impostazioni',
                es: 'Restablecer todos los ajustes'
            },
            'options.resetConfirm': {
                fr: 'Supprimer tous les paramétrages enregistrés ?',
                en: 'Delete every saved setting?',
                it: 'Eliminare tutte le impostazioni salvate?',
                es: '¿Eliminar todos los ajustes guardados?'
            },
            // --- Settings ---
            'settings.display.language': {
                fr: 'Langue',
                en: 'Language',
                it: 'Lingua',
                es: 'Idioma'
            },
            'settings.display.renderer': {
                fr: 'Moteur de rendu',
                en: 'Rendering engine',
                it: 'Motore di rendering',
                es: 'Motor de renderizado'
            },
            'hud.lapTime': {
                fr: 'Temps du tour',
                en: 'Lap time',
                it: 'Tempo sul giro',
                es: 'Tiempo de vuelta'
            },
            'hud.fastestLap': {
                fr: 'Record du tour',
                en: 'Fastest lap',
                it: 'Giro record',
                es: 'Vuelta récord'
            },
            'hud.laps': {
                fr: 'Tour',
                en: 'Lap',
                it: 'Giro',
                es: 'Vuelta'
            },
            'hud.speed': {
                fr: 'Vitesse',
                en: 'Speed',
                it: 'Velocità',
                es: 'Velocidad'
            },
            'hud.gear': {
                fr: 'Rapport',
                en: 'Gear',
                it: 'Marcia',
                es: 'Marcha'
            },
            'hud.rpm': {
                fr: 'x1000 tr/min',
                en: 'x1000 rpm',
                it: 'x1000 giri',
                es: 'x1000 rpm'
            },
            'hud.ready': {
                fr: 'Prêt',
                en: 'Ready',
                it: 'Pronti',
                es: 'Listos'
            },
            'hud.reverse': {
                fr: 'Contresens',
                en: 'Reverse',
                it: 'Contromano',
                es: 'Sentido contrario'
            },
            'hud.pitWork': {
                fr: 'Arrêt aux stands',
                en: 'Pit work',
                it: 'Pit stop',
                es: 'Parada en boxes'
            },
            'hud.start.pitStart': {
                fr: 'Départ des stands',
                en: 'Pit start',
                it: 'Partenza dai box',
                es: 'Salida desde boxes'
            },
            'hud.start.go': {
                fr: 'GO!',
                en: 'GO!',
                it: 'GO!',
                es: 'GO!'
            },
            'hud.message.lapTime': {
                fr: 'Temps du tour',
                en: 'Lap time',
                it: 'Tempo sul giro',
                es: 'Tiempo de vuelta'
            },
            'hud.message.bestLap': {
                fr: 'Meilleur tour',
                en: 'Best lap',
                it: 'Giro migliore',
                es: 'Mejor vuelta'
            },
            'hud.message.fastestLap': {
                fr: 'Record du tour !',
                en: 'Fastest lap!',
                it: 'Giro record!',
                es: '¡Vuelta récord!'
            },
            'hud.lapTimeOf': {
                fr: 'Temps du tour {lap}',
                en: 'Lap {lap} time',
                it: 'Tempo del giro {lap}',
                es: 'Tiempo de la vuelta {lap}'
            },
            'hud.automatic': {
                fr: '(A)',
                en: '(A)',
                it: '(A)',
                es: '(A)'
            },
            'hud.fps': {
                fr: '{value} fps',
                en: '{value} fps',
                it: '{value} fps',
                es: '{value} fps'
            },
            'settings.display.showFps': {
                fr: 'Afficher le framerate',
                en: 'Show the framerate',
                it: 'Mostra il frame rate',
                es: 'Mostrar los FPS'
            },
            'settings.display.speedUnit': {
                fr: 'Unité de vitesse',
                en: 'Speed unit',
                it: 'Unità di velocità',
                es: 'Unidad de velocidad'
            },
            'settings.sound.volumeMusic': {
                fr: 'Volume de la musique',
                en: 'Music volume',
                it: 'Volume della musica',
                es: 'Volumen de la música'
            },
            'settings.sound.volumeEffects': {
                fr: 'Volume des effets',
                en: 'Effects volume',
                it: 'Volume degli effetti',
                es: 'Volumen de los efectos'
            },
            'settings.race.laps': {
                fr: 'Nombre de tours',
                en: 'Number of laps',
                it: 'Numero di giri',
                es: 'Número de vueltas'
            },
            'settings.race.camera': {
                fr: 'Caméra par défaut',
                en: 'Default camera',
                it: 'Telecamera predefinita',
                es: 'Cámara predeterminada'
            },
            'settings.virtualPad.deadZone': {
                fr: 'Stick de direction — zone morte',
                en: 'Steering stick — dead zone',
                it: 'Stick di sterzo — zona morta',
                es: 'Stick de dirección — zona muerta'
            },
            'settings.multiplayer.laps': {
                fr: 'Nombre de tours',
                en: 'Number of laps',
                it: 'Numero di giri',
                es: 'Número de vueltas'
            },
            'settings.multiplayer.nickname': {
                fr: 'Surnom',
                en: 'Nickname',
                it: 'Soprannome',
                es: 'Apodo'
            },
            // --- Control actions ---
            'settings.action.steerLeft': {
                fr: 'Tourner à gauche',
                en: 'Steer left',
                it: 'Sterza a sinistra',
                es: 'Girar a la izquierda'
            },
            'settings.action.steerRight': {
                fr: 'Tourner à droite',
                en: 'Steer right',
                it: 'Sterza a destra',
                es: 'Girar a la derecha'
            },
            'settings.action.steer': {
                fr: 'Direction',
                en: 'Steering',
                it: 'Sterzo',
                es: 'Dirección'
            },
            'settings.action.accelerate': {
                fr: 'Accélérer',
                en: 'Accelerate',
                it: 'Accelera',
                es: 'Acelerar'
            },
            'settings.action.brake': {
                fr: 'Freiner',
                en: 'Brake',
                it: 'Frena',
                es: 'Frenar'
            },
            'settings.action.view': {
                fr: 'Changer de vue',
                en: 'Change view',
                it: 'Cambia visuale',
                es: 'Cambiar de vista'
            },
            'settings.action.gearUp': {
                fr: 'Rapport +',
                en: 'Gear up',
                it: 'Marcia +',
                es: 'Marcha +'
            },
            'settings.action.gearDown': {
                fr: 'Rapport −',
                en: 'Gear down',
                it: 'Marcia −',
                es: 'Marcha −'
            },
            'settings.action.pause': {
                fr: 'Pause',
                en: 'Pause',
                it: 'Pausa',
                es: 'Pausa'
            },
            // --- Setting values ---
            'value.renderer.softwareTextured': {
                fr: 'Logiciel texturé',
                en: 'Software textured',
                it: 'Software con texture',
                es: 'Software con texturas'
            },
            'value.renderer.softwareFlat': {
                fr: 'Logiciel en aplats',
                en: 'Software flat',
                it: 'Software a tinte piatte',
                es: 'Software plano'
            },
            'value.renderer.softwareWireframe': {
                fr: 'Logiciel filaire',
                en: 'Software wireframe',
                it: 'Software wireframe',
                es: 'Software de alambre'
            },
            'value.camera.cockpit': {
                fr: 'Cockpit',
                en: 'Cockpit',
                it: 'Abitacolo',
                es: 'Cabina'
            },
            'value.camera.closeView': {
                fr: 'Vue rapprochée',
                en: 'Close view',
                it: 'Visuale ravvicinata',
                es: 'Vista cercana'
            },
            'value.camera.farView': {
                fr: 'Vue éloignée',
                en: 'Far view',
                it: 'Visuale lontana',
                es: 'Vista lejana'
            },
            'value.camera.highView': {
                fr: 'Vue haute',
                en: 'High view',
                it: 'Visuale dall\'alto',
                es: 'Vista elevada'
            },
            'value.speedUnit.auto': {
                fr: 'Selon la langue',
                en: 'From the language',
                it: 'Secondo la lingua',
                es: 'Según el idioma'
            },
            // --- Race ---
            'race.failed': {
                fr: 'La course s’est arrêtée sur une erreur.',
                en: 'The race stopped on an error.',
                it: 'La gara si è interrotta per un errore.',
                es: 'La carrera se detuvo por un error.'
            },
            'race.pause.title': {
                fr: '{course} — {car}',
                en: '{course} — {car}',
                it: '{course} — {car}',
                es: '{course} — {car}'
            },
            'race.pause.resume': {
                fr: 'Revenir à la course',
                en: 'Back to the race',
                it: 'Torna alla gara',
                es: 'Volver a la carrera'
            },
            'race.pause.restart': {
                fr: 'Recommencer la course',
                en: 'Restart the race',
                it: 'Ricomincia la gara',
                es: 'Reiniciar la carrera'
            },
            'race.pause.restartConfirm': {
                fr: 'Recommencer la course ?',
                en: 'Restart the race?',
                it: 'Ricominciare la gara?',
                es: '¿Reiniciar la carrera?'
            },
            'race.pause.restartButton': {
                fr: 'Recommencer',
                en: 'Restart',
                it: 'Ricomincia',
                es: 'Reiniciar'
            },
            'race.pause.quit': {
                fr: 'Quitter la course',
                en: 'Leave the race',
                it: 'Esci dalla gara',
                es: 'Salir de la carrera'
            },
            'race.results.title': {
                fr: '{course} — {car} — Arrivée',
                en: '{course} — {car} — Finish',
                it: '{course} — {car} — Arrivo',
                es: '{course} — {car} — Llegada'
            },
            'race.results.lap': {
                fr: 'Tour {lap}',
                en: 'Lap {lap}',
                it: 'Giro {lap}',
                es: 'Vuelta {lap}'
            },
            'race.results.total': {
                fr: 'Temps total',
                en: 'Total time',
                it: 'Tempo totale',
                es: 'Tiempo total'
            },
            'race.results.bestLap': {
                fr: 'Meilleur tour',
                en: 'Fastest lap',
                it: 'Giro più veloce',
                es: 'Vuelta más rápida'
            },
            'race.results.record': {
                fr: 'Nouveau record !',
                en: 'New record!',
                it: 'Nuovo record!',
                es: '¡Nuevo récord!'
            },
            'race.results.restart': {
                fr: 'Recommencer',
                en: 'Restart',
                it: 'Ricomincia',
                es: 'Reiniciar'
            },
            'race.results.courses': {
                fr: 'Changer de circuit',
                en: 'Change the course',
                it: 'Cambia circuito',
                es: 'Cambiar de circuito'
            },
            'car.bestTimes': {
                fr: 'Tour {lap} · Course {race}',
                en: 'Lap {lap} · Race {race}',
                it: 'Giro {lap} · Gara {race}',
                es: 'Vuelta {lap} · Carrera {race}'
            },
            // --- Help ---
            'help.race': {
                fr: 'La course',
                en: 'The race',
                it: 'La gara',
                es: 'La carrera'
            },
            'help.race.solo': {
                fr: 'Vous roulez seul sur le circuit, contre le chronomètre : choisissez un circuit (ou sa variante miroir), puis une voiture et sa boîte de vitesses.',
                en: 'You drive alone on the course, against the clock: choose a course (or its mirrored version), then a car and its transmission.',
                it: 'Corri da solo sul circuito, contro il cronometro: scegli un circuito (o la sua versione specchiata), poi una vettura e il suo cambio.',
                es: 'Corres solo en el circuito, contra el reloj: elige un circuito (o su versión espejo), luego un coche y su caja de cambios.'
            },
            'help.race.laps': {
                fr: 'Le nombre de tours se règle dans Options > Course (5 par défaut).',
                en: 'The number of laps is set in Options > Race (5 by default).',
                it: 'Il numero di giri si imposta in Opzioni > Gara (5 per impostazione predefinita).',
                es: 'El número de vueltas se ajusta en Opciones > Carrera (5 por defecto).'
            },
            'help.start': {
                fr: 'Le départ',
                en: 'The start',
                it: 'La partenza',
                es: 'La salida'
            },
            'help.start.pits': {
                fr: 'À Big Forest, la voiture part des stands, entourée des mécaniciens, après le décompte 3, 2, 1, GO!',
                en: 'At Big Forest, the car starts from the pits, surrounded by the mechanics, after the 3, 2, 1, GO! countdown.',
                it: 'A Big Forest, la vettura parte dai box, circondata dai meccanici, dopo il conto alla rovescia 3, 2, 1, GO!',
                es: 'En Big Forest, el coche sale desde boxes, rodeado de los mecánicos, tras la cuenta atrás 3, 2, 1, GO!'
            },
            'help.start.lights': {
                fr: 'Sur les autres circuits, elle attend sur la grille : les feux passent au rouge, puis au vert pour le départ. En accélérant avant, le moteur monte en régime sur place.',
                en: 'On the other courses, it waits on the grid: the lights turn red, then green for the start. Accelerating before then revs the engine on the spot.',
                it: 'Sugli altri circuiti, attende sulla griglia: i semafori diventano rossi, poi verdi per la partenza. Accelerando prima, il motore sale di giri sul posto.',
                es: 'En los demás circuitos, espera en la parrilla: los semáforos se ponen en rojo y luego en verde para la salida. Acelerando antes, el motor sube de vueltas en el sitio.'
            },
            'help.times': {
                fr: 'Tours et temps',
                en: 'Laps and times',
                it: 'Giri e tempi',
                es: 'Vueltas y tiempos'
            },
            'help.times.lap': {
                fr: 'En haut à droite : le record du tour, le temps du tour en cours et ceux des derniers tours. À chaque passage de la ligne s\'affiche le temps du tour, « Meilleur tour » s\'il est le meilleur de la course, « Record du tour ! » s\'il bat le record.',
                en: 'Top right: the fastest lap, the time of the current lap and those of the last laps. At each crossing of the line, the lap time shows, "Best lap" if it is the best of the race, "Fastest lap!" if it beats the record.',
                it: 'In alto a destra: il giro record, il tempo del giro in corso e quelli degli ultimi giri. A ogni passaggio sulla linea appare il tempo del giro, «Giro migliore» se è il migliore della gara, «Giro record!» se batte il record.',
                es: 'Arriba a la derecha: la vuelta récord, el tiempo de la vuelta en curso y los de las últimas vueltas. En cada paso por la línea aparece el tiempo de la vuelta, «Mejor vuelta» si es la mejor de la carrera, «¡Vuelta récord!» si bate el récord.'
            },
            'help.times.checkpoints': {
                fr: 'Chaque tour a deux points de passage, sous des banderoles. Une fois un record établi, l\'écart avec lui s\'y affiche : + en rouge si vous êtes plus lent, − en jaune si vous êtes plus rapide.',
                en: 'Each lap has two checkpoints, under banners. Once a record is set, the gap to it shows there: + in red when you are slower, − in yellow when you are faster.',
                it: 'Ogni giro ha due punti di passaggio, sotto degli striscioni. Una volta stabilito un record, vi appare il distacco: + in rosso se sei più lento, − in giallo se sei più veloce.',
                es: 'Cada vuelta tiene dos puntos de control, bajo pancartas. Una vez establecido un récord, se muestra la diferencia con él: + en rojo si eres más lento, − en amarillo si eres más rápido.'
            },
            'help.times.records': {
                fr: 'Les records sont gardés sur cet appareil, par circuit, variante miroir et voiture : le meilleur tour dès qu\'il est bouclé, la meilleure course à l\'arrivée. Ils se consultent et s\'effacent dans Meilleurs tours.',
                en: 'The records are kept on this device, by course, mirrored version and car: the fastest lap as soon as it is done, the best race at the finish. They are shown and erased in Best laps.',
                it: 'I record sono conservati su questo dispositivo, per circuito, versione specchiata e vettura: il giro record appena completato, la gara migliore all\'arrivo. Si consultano e si cancellano in Giri migliori.',
                es: 'Los récords se guardan en este dispositivo, por circuito, versión espejo y coche: la vuelta récord en cuanto se completa, la mejor carrera en la meta. Se consultan y se borran en Mejores vueltas.'
            },
            'help.driving': {
                fr: 'Conduite',
                en: 'Driving',
                it: 'Guida',
                es: 'Conducción'
            },
            'help.driving.gearbox': {
                fr: 'En boîte manuelle, vous passez les rapports vous-même : rétrograder trop tôt fait sur-régimer le moteur et freine la voiture d\'un coup.',
                en: 'With the manual transmission, you shift the gears yourself: shifting down too early over-revs the engine and brakes the car at once.',
                it: 'Con il cambio manuale, cambi le marce tu stesso: scalare troppo presto manda il motore fuori giri e frena di colpo la vettura.',
                es: 'Con la caja manual, cambias tú las marchas: reducir demasiado pronto pasa de vueltas el motor y frena el coche de golpe.'
            },
            'help.driving.grip': {
                fr: 'Braquer à fond trop vite fait glisser la voiture, jusqu\'au tête-à-queue. L\'herbe et le sable la ralentissent.',
                en: 'Steering hard at too high a speed makes the car slide, up to a spin. Grass and sand slow it down.',
                it: 'Sterzare a fondo a velocità troppo alta fa scivolare la vettura, fino al testacoda. L\'erba e la sabbia la rallentano.',
                es: 'Girar a fondo a demasiada velocidad hace derrapar el coche, hasta el trompo. La hierba y la arena lo frenan.'
            },
            'help.driving.walls': {
                fr: 'Frôler un mur vous dévie. Le percuter de face à pleine vitesse fait culbuter la voiture.',
                en: 'Brushing a wall deflects you. Hitting it head-on at full speed flips the car over.',
                it: 'Sfiorare un muro ti devia. Colpirlo frontalmente a tutta velocità fa ribaltare la vettura.',
                es: 'Rozar un muro te desvía. Chocar de frente a toda velocidad hace volcar el coche.'
            },
            'help.driving.reverse': {
                fr: '« Contresens » s\'affiche quand vous roulez dans le mauvais sens. Une ligne franchie à l\'envers doit être refranchie dans le bon sens avant que le tour ne compte.',
                en: '"Reverse" shows when you drive the wrong way. A line crossed backwards must be crossed again the right way before the lap counts.',
                it: '«Contromano» appare quando guidi nel senso sbagliato. Una linea attraversata al contrario va riattraversata nel senso giusto prima che il giro conti.',
                es: '«Sentido contrario» aparece cuando conduces en el sentido equivocado. Una línea cruzada al revés debe cruzarse de nuevo en el sentido correcto antes de que la vuelta cuente.'
            },
            'help.driving.views': {
                fr: 'Quatre vues se suivent : le cockpit, la vue rapprochée, la vue éloignée et la vue haute.',
                en: 'Four views follow one another: the cockpit, the close view, the far view and the high view.',
                it: 'Quattro visuali si susseguono: l\'abitacolo, la visuale ravvicinata, la visuale lontana e la visuale dall\'alto.',
                es: 'Cuatro vistas se suceden: la cabina, la vista cercana, la vista lejana y la vista elevada.'
            },
            'help.damage': {
                fr: 'Dégâts et stands',
                en: 'Damage and pits',
                it: 'Danni e box',
                es: 'Daños y boxes'
            },
            'help.damage.crash': {
                fr: 'Un choc de face contre un mur à pleine vitesse abîme la voiture : sa carrosserie se déforme, sa vitesse de pointe baisse et elle freine davantage. Chaque nouveau choc l\'aggrave.',
                en: 'A head-on crash into a wall at full speed damages the car: its body is bent, its top speed drops and it drags more. Each new crash makes it worse.',
                it: 'Un urto frontale contro un muro a tutta velocità danneggia la vettura: la carrozzeria si deforma, la velocità massima cala e frena di più. Ogni nuovo urto peggiora la situazione.',
                es: 'Un choque frontal contra un muro a toda velocidad daña el coche: la carrocería se deforma, la velocidad punta baja y frena más. Cada nuevo choque lo empeora.'
            },
            'help.damage.pits': {
                fr: 'Big Forest, Acropolis et Highland ont une voie des stands : en y roulant sur la bande à son entrée, la voiture est conduite jusqu\'à sa place, où les mécaniciens changent les roues et réparent les dégâts en 6 secondes. Les arrêts ne sont pas limités.',
                en: 'Big Forest, Acropolis and Highland have a pit lane: driving over the band at its entrance, the car is driven to its box, where the mechanics change the wheels and repair the damage in 6 seconds. Pit stops are not limited.',
                it: 'Big Forest, Acropolis e Highland hanno una corsia dei box: passando sulla striscia al suo ingresso, la vettura viene guidata fino alla sua piazzola, dove i meccanici cambiano le ruote e riparano i danni in 6 secondi. Le soste non sono limitate.',
                es: 'Big Forest, Acropolis y Highland tienen calle de boxes: pasando sobre la franja de su entrada, el coche es conducido hasta su puesto, donde los mecánicos cambian las ruedas y reparan los daños en 6 segundos. Las paradas no tienen límite.'
            },
            'help.damage.noPits': {
                fr: 'Bay Bridge et Sand Park n\'en ont pas : les dégâts y restent jusqu\'à la fin de la course.',
                en: 'Bay Bridge and Sand Park have none: the damage stays there until the end of the race.',
                it: 'Bay Bridge e Sand Park non ne hanno: i danni restano fino alla fine della gara.',
                es: 'Bay Bridge y Sand Park no tienen: los daños se mantienen hasta el final de la carrera.'
            },
            'help.finish': {
                fr: 'L\'arrivée',
                en: 'The finish',
                it: 'L\'arrivo',
                es: 'La llegada'
            },
            'help.finish.results': {
                fr: 'Après le dernier tour, la voiture continue seule et les résultats s\'affichent : le temps de chaque tour, le meilleur tour, le temps total et les nouveaux records. Vous pouvez alors recommencer, changer de circuit ou revenir au menu principal.',
                en: 'After the last lap, the car drives on by itself and the results show: the time of each lap, the best lap, the total time and the new records. You can then restart, change course or go back to the main menu.',
                it: 'Dopo l\'ultimo giro, la vettura prosegue da sola e appaiono i risultati: il tempo di ogni giro, il giro migliore, il tempo totale e i nuovi record. Puoi allora ricominciare, cambiare circuito o tornare al menu principale.',
                es: 'Tras la última vuelta, el coche sigue solo y aparecen los resultados: el tiempo de cada vuelta, la mejor vuelta, el tiempo total y los nuevos récords. Puedes entonces volver a empezar, cambiar de circuito o volver al menú principal.'
            },
            'help.pauseKey': {
                fr: 'En course, la touche Échap et le bouton Pause de la manette ouvrent toujours le menu pause. Les autres commandes se règlent dans Options > Contrôles.',
                en: 'During a race, the Escape key and the Pause button of the gamepad always open the pause menu. The other controls are set in Options > Controls.',
                it: 'In gara, il tasto Esc e il pulsante Pausa del gamepad aprono sempre il menu di pausa. Gli altri comandi si impostano in Opzioni > Comandi.',
                es: 'En carrera, la tecla Esc y el botón Pausa del mando siempre abren el menú de pausa. Los demás controles se ajustan en Opciones > Controles.'
            },
            'help.about': {
                fr: 'À propos',
                en: 'About',
                it: 'Informazioni',
                es: 'Acerca de'
            },
            'help.about.what': {
                fr: 'Spipu-Racing est un jeu de course qui reprend Virtua Racing Deluxe (Sega 32X) : circuits, voitures, physique et bruitages d\'origine, en haute définition dans le navigateur.',
                en: 'Spipu-Racing is a racing game after Virtua Racing Deluxe (Sega 32X): the original courses, cars, physics and sound effects, in high definition in the browser.',
                it: 'Spipu-Racing è un gioco di corse che riprende Virtua Racing Deluxe (Sega 32X): circuiti, vetture, fisica ed effetti sonori originali, in alta definizione nel browser.',
                es: 'Spipu-Racing es un juego de carreras que retoma Virtua Racing Deluxe (Sega 32X): los circuitos, coches, físicas y efectos de sonido originales, en alta definición en el navegador.'
            },
            'help.about.sega': {
                fr: 'Virtua Racing Deluxe © SEGA 1992, 1994 : les données du jeu d\'origine sont utilisées pour un usage privé uniquement.',
                en: 'Virtua Racing Deluxe © SEGA 1992, 1994: the data of the original game is used for private use only.',
                it: 'Virtua Racing Deluxe © SEGA 1992, 1994: i dati del gioco originale sono utilizzati solo per uso privato.',
                es: 'Virtua Racing Deluxe © SEGA 1992, 1994: los datos del juego original se utilizan solo para uso privado.'
            },
            'help.about.commercial': {
                fr: 'Spipu-Racing est gratuit et à but non lucratif. Toute exploitation commerciale, directe ou indirecte, est interdite : vente, location, publicité, abonnement, dons ou toute autre forme de rémunération ou de profit.',
                en: 'Spipu-Racing is free and non-profit. Any commercial use, direct or indirect, is prohibited: sale, rental, advertising, subscription, donations or any other form of payment or profit.',
                it: 'Spipu-Racing è gratuito e senza scopo di lucro. Qualsiasi sfruttamento commerciale, diretto o indiretto, è vietato: vendita, noleggio, pubblicità, abbonamento, donazioni o qualsiasi altra forma di compenso o profitto.',
                es: 'Spipu-Racing es gratuito y sin ánimo de lucro. Queda prohibida toda explotación comercial, directa o indirecta: venta, alquiler, publicidad, suscripción, donaciones o cualquier otra forma de remuneración o beneficio.'
            },
            'help.about.author': {
                fr: 'Développé par Spipu (Laurent Minguet).',
                en: 'Developed by Spipu (Laurent Minguet).',
                it: 'Sviluppato da Spipu (Laurent Minguet).',
                es: 'Desarrollado por Spipu (Laurent Minguet).'
            },
            'help.about.copyright': {
                fr: '© {year} Spipu.',
                en: '© {year} Spipu.',
                it: '© {year} Spipu.',
                es: '© {year} Spipu.'
            }
        };
    }
}
