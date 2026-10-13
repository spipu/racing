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
            'help.pauseKey': {
                fr: 'En course, la touche Échap et le bouton Pause de la manette ouvrent toujours le menu pause. Les commandes se changent dans Options.',
                en: 'During a race, the Escape key and the Pause button of the gamepad always open the pause menu. The controls are changed in Options.',
                it: 'In gara, il tasto Esc e il pulsante Pausa del gamepad aprono sempre il menu di pausa. I comandi si cambiano in Opzioni.',
                es: 'En carrera, la tecla Esc y el botón Pausa del mando siempre abren el menú de pausa. Los controles se cambian en Opciones.'
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
