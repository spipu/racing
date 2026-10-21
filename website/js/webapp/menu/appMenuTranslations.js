/**
 * Texts of the js/webapp/ menus, in every language of the projects that use
 * them. A project adds this catalog next to its own (appTranslator.addCatalog).
 */
class AppMenuTranslations {
    static get CATALOG() {
        return {
            // --- Buttons ---
            'menu.back': {
                fr: 'Retour',
                en: 'Back',
                it: 'Indietro',
                es: 'Volver'
            },
            'menu.close': {
                fr: 'Fermer',
                en: 'Close',
                it: 'Chiudi',
                es: 'Cerrar'
            },
            'menu.confirm': {
                fr: 'Confirmer',
                en: 'Confirm',
                it: 'Conferma',
                es: 'Confirmar'
            },
            'menu.cancel': {
                fr: 'Annuler',
                en: 'Cancel',
                it: 'Annulla',
                es: 'Cancelar'
            },
            // --- On-screen keyboard ---
            'key.space': {
                fr: 'Espace',
                en: 'Space',
                it: 'Spazio',
                es: 'Espacio'
            },
            'key.arrowLeft': {
                fr: 'Flèche gauche',
                en: 'Left arrow',
                it: 'Freccia sinistra',
                es: 'Flecha izquierda'
            },
            'key.arrowRight': {
                fr: 'Flèche droite',
                en: 'Right arrow',
                it: 'Freccia destra',
                es: 'Flecha derecha'
            },
            'key.arrowUp': {
                fr: 'Flèche haut',
                en: 'Up arrow',
                it: 'Freccia su',
                es: 'Flecha arriba'
            },
            'key.arrowDown': {
                fr: 'Flèche bas',
                en: 'Down arrow',
                it: 'Freccia giù',
                es: 'Flecha abajo'
            },
            // Accessible name of the erase key.
            'menu.keyboard.erase': {
                fr: 'Effacer',
                en: 'Erase',
                it: 'Cancella',
                es: 'Borrar'
            },
            // --- Setting values ---
            'value.yes': {
                fr: 'Oui',
                en: 'Yes',
                it: 'Sì',
                es: 'Sí'
            },
            'value.no': {
                fr: 'Non',
                en: 'No',
                it: 'No',
                es: 'No'
            },
            // --- Control binding capture and labels ---
            'menu.capture.key': {
                fr: 'Appuyez sur la touche à utiliser pour « {action} »…',
                en: 'Press the key to use for "{action}"…',
                it: 'Premi il tasto da usare per «{action}»…',
                es: 'Pulsa la tecla que quieres usar para «{action}»…'
            },
            'menu.capture.padButton': {
                fr: 'Appuyez sur le bouton de la manette à utiliser pour « {action} »…',
                en: 'Press the gamepad button to use for "{action}"…',
                it: 'Premi il pulsante del controller da usare per «{action}»…',
                es: 'Pulsa el botón del mando que quieres usar para «{action}»…'
            },
            'menu.capture.padAxis.right': {
                fr: 'Poussez vers la droite le stick à utiliser pour « {action} »…',
                en: 'Push right on the stick to use for "{action}"…',
                it: 'Spingi a destra lo stick da usare per «{action}»…',
                es: 'Empuja hacia la derecha el stick que quieres usar para «{action}»…'
            },
            'menu.capture.padAxis.up': {
                fr: 'Poussez vers le haut le stick à utiliser pour « {action} »…',
                en: 'Push up on the stick to use for "{action}"…',
                it: 'Spingi in alto lo stick da usare per «{action}»…',
                es: 'Empuja hacia arriba el stick que quieres usar para «{action}»…'
            },
            'pad.button': {
                fr: 'Bouton {number}',
                en: 'Button {number}',
                it: 'Pulsante {number}',
                es: 'Botón {number}'
            },
            'pad.axis': {
                fr: 'Axe {number}',
                en: 'Axis {number}',
                it: 'Asse {number}',
                es: 'Eje {number}'
            },
            'menu.binding': {
                fr: '{action} : {control}',
                en: '{action}: {control}',
                it: '{action}: {control}',
                es: '{action}: {control}'
            },
            'menu.unbound': {
                fr: 'non attribuée',
                en: 'not set',
                it: 'non assegnato',
                es: 'sin asignar'
            },
            'pad.axisInverted': {
                fr: 'Axe {number} inversé',
                en: 'Axis {number} inverted',
                it: 'Asse {number} invertito',
                es: 'Eje {number} invertido'
            },
            'key.shift': {
                fr: 'Maj',
                en: 'Shift',
                it: 'Maiusc',
                es: 'Mayús'
            },
            'key.left': {
                fr: '{key} gauche',
                en: 'Left {key}',
                it: '{key} sinistro',
                es: '{key} izquierda'
            },
            'key.right': {
                fr: '{key} droite',
                en: 'Right {key}',
                it: '{key} destro',
                es: '{key} derecha'
            },
            'key.numpad': {
                fr: 'Num {key}',
                en: 'Numpad {key}',
                it: 'Num {key}',
                es: 'Num {key}'
            },
            // --- Units ---
            'unit.byte': {
                fr: 'o',
                en: 'B',
                it: 'B',
                es: 'B'
            },
            'unit.kilobyte': {
                fr: 'Ko',
                en: 'KB',
                it: 'KB',
                es: 'KB'
            },
            'unit.megabyte': {
                fr: 'Mo',
                en: 'MB',
                it: 'MB',
                es: 'MB'
            },
            // --- Multiplayer (js/webapp/net/ sessions, their menus) ---
            'multiplayer.join': {
                fr: 'Rejoindre une partie',
                en: 'Join a game',
                it: 'Unisciti a una partita',
                es: 'Unirse a una partida'
            },
            'multiplayer.nickname.prompt': {
                fr: 'Veuillez saisir votre surnom',
                en: 'Please enter your nickname',
                it: 'Inserisci il tuo soprannome',
                es: 'Introduce tu apodo'
            },
            'multiplayer.pairing.showToMain': {
                fr: 'Montrez ce code à l\'hôte',
                en: 'Show this code to the host',
                it: 'Mostra questo codice all\'host',
                es: 'Muestra este código al anfitrión'
            },
            'multiplayer.pairing.readMain': {
                fr: 'Scannez le code de l\'hôte',
                en: 'Scan the host\'s code',
                it: 'Inquadra il codice dell\'host',
                es: 'Escanea el código del anfitrión'
            },
            'multiplayer.pairing.showToSub': {
                fr: 'Scannez ce code depuis l\'autre appareil',
                en: 'Scan this code from the other device',
                it: 'Inquadra questo codice dall\'altro dispositivo',
                es: 'Escanea este código desde el otro dispositivo'
            },
            'multiplayer.pairing.readSub': {
                fr: 'Scannez la réponse de l\'autre appareil',
                en: 'Scan the other device\'s answer',
                it: 'Inquadra la risposta dell\'altro dispositivo',
                es: 'Escanea la respuesta del otro dispositivo'
            },
            'multiplayer.pairing.connecting': {
                fr: 'Connexion en cours…',
                en: 'Connecting…',
                it: 'Connessione in corso…',
                es: 'Conectando…'
            },
            'multiplayer.pairing.connectingTo': {
                fr: 'Connexion à {nickname} en cours…',
                en: 'Connecting to {nickname}…',
                it: 'Connessione a {nickname} in corso…',
                es: 'Conectando con {nickname}…'
            },
            'multiplayer.lobby.title': {
                fr: 'Salon — {count}/{capacity} joueurs',
                en: 'Lobby — {count}/{capacity} players',
                it: 'Sala — {count}/{capacity} giocatori',
                es: 'Sala — {count}/{capacity} jugadores'
            },
            'multiplayer.lobby.player': {
                fr: '{slot}. {nickname}',
                en: '{slot}. {nickname}',
                it: '{slot}. {nickname}',
                es: '{slot}. {nickname}'
            },
            'multiplayer.lobby.main': {
                fr: 'Hôte',
                en: 'Host',
                it: 'Host',
                es: 'Anfitrión'
            },
            'multiplayer.lobby.ping': {
                fr: '{ping} ms',
                en: '{ping} ms',
                it: '{ping} ms',
                es: '{ping} ms'
            },
            'multiplayer.lobby.pingPending': {
                fr: 'Connexion…',
                en: 'Connecting…',
                it: 'Connessione…',
                es: 'Conectando…'
            },
            'multiplayer.lobby.away': {
                fr: 'En veille',
                en: 'Away',
                it: 'In standby',
                es: 'En espera'
            },
            'multiplayer.lobby.disconnected': {
                fr: 'Hors ligne',
                en: 'Offline',
                it: 'Non in linea',
                es: 'Sin conexión'
            },
            'multiplayer.lobby.add': {
                fr: 'Ajouter un joueur',
                en: 'Add a player',
                it: 'Aggiungi un giocatore',
                es: 'Añadir un jugador'
            },
            'multiplayer.lobby.start': {
                fr: 'Démarrer',
                en: 'Start',
                it: 'Avvia',
                es: 'Empezar'
            },
            'multiplayer.lobby.leave': {
                fr: 'Quitter',
                en: 'Leave',
                it: 'Esci',
                es: 'Salir'
            },
            'multiplayer.lobby.remove': {
                fr: 'Retirer',
                en: 'Remove',
                it: 'Rimuovi',
                es: 'Quitar'
            },
            'multiplayer.lobby.removeConfirm': {
                fr: 'Retirer {nickname} de la partie ?',
                en: 'Remove {nickname} from the game?',
                it: 'Rimuovere {nickname} dalla partita?',
                es: '¿Quitar a {nickname} de la partida?'
            },
            'multiplayer.lobby.inProgress': {
                fr: 'Partie en cours chez l\'hôte',
                en: 'Game in progress on the host',
                it: 'Partita in corso sull\'host',
                es: 'Partida en curso en el anfitrión'
            },
            'multiplayer.unavailable.webgl': {
                fr: 'Le multijoueur nécessite WebGL, indisponible sur cet appareil',
                en: 'Multiplayer needs WebGL, unavailable on this device',
                it: 'Il multigiocatore richiede WebGL, non disponibile su questo dispositivo',
                es: 'El multijugador necesita WebGL, no disponible en este dispositivo'
            },
            'multiplayer.unavailable.camera': {
                fr: 'Le multijoueur nécessite une caméra pour appairer les appareils',
                en: 'Multiplayer needs a camera to pair the devices',
                it: 'Il multigiocatore richiede una fotocamera per associare i dispositivi',
                es: 'El multijugador necesita una cámara para emparejar los dispositivos'
            },
            'multiplayer.error.version': {
                fr: 'L\'autre appareil utilise une autre version du jeu : rechargez les deux',
                en: 'The other device runs another version of the game: reload both',
                it: 'L\'altro dispositivo usa un\'altra versione del gioco: ricaricali entrambi',
                es: 'El otro dispositivo usa otra versión del juego: recarga ambos'
            },
            'multiplayer.error.invite': {
                fr: 'Ce code a déjà servi : ajoutez à nouveau le joueur',
                en: 'This code was already used: add the player again',
                it: 'Questo codice è già stato usato: aggiungi di nuovo il giocatore',
                es: 'Este código ya se usó: añade de nuevo al jugador'
            },
            'multiplayer.error.connect': {
                fr: 'La connexion entre les deux appareils n\'a pas pu être établie : mettez-les sur le même Wi-Fi, ou sur le partage de connexion de l\'un d\'eux',
                en: 'The two devices could not connect: put them on the same Wi-Fi, or on one device\'s hotspot',
                it: 'I due dispositivi non sono riusciti a connettersi: mettili sulla stessa rete Wi-Fi, o sull\'hotspot di uno dei due',
                es: 'Los dos dispositivos no pudieron conectarse: ponlos en la misma red Wi-Fi, o en el punto de acceso de uno de ellos'
            },
            'multiplayer.error.otherNetwork': {
                fr: 'L\'autre appareil est sur un autre réseau (Wi-Fi contre données mobiles, par exemple) : mettez les deux appareils sur le même Wi-Fi, ou sur le partage de connexion de l\'un d\'eux',
                en: 'The other device is on another network (Wi-Fi against mobile data, for instance): put both devices on the same Wi-Fi, or on one device\'s hotspot',
                it: 'L\'altro dispositivo è su un\'altra rete (Wi-Fi contro dati mobili, per esempio): metti entrambi i dispositivi sulla stessa rete Wi-Fi, o sull\'hotspot di uno dei due',
                es: 'El otro dispositivo está en otra red (Wi-Fi frente a datos móviles, por ejemplo): pon ambos dispositivos en la misma red Wi-Fi, o en el punto de acceso de uno de ellos'
            },
            'multiplayer.error.sameNetwork': {
                fr: 'Les deux appareils sont sur le même réseau mais ne parviennent pas à se joindre : ce Wi-Fi isole peut-être ses appareils entre eux (réseau invité)',
                en: 'The two devices are on the same network but cannot reach each other: this Wi-Fi may keep its devices apart (guest network)',
                it: 'I due dispositivi sono sulla stessa rete ma non riescono a raggiungersi: questo Wi-Fi forse isola i suoi dispositivi (rete ospiti)',
                es: 'Los dos dispositivos están en la misma red pero no logran comunicarse: este Wi-Fi quizá aísla sus dispositivos entre sí (red de invitados)'
            },
            'multiplayer.error.pairing': {
                fr: 'L\'appairage a échoué',
                en: 'The pairing failed',
                it: 'Associazione non riuscita',
                es: 'El emparejamiento ha fallado'
            },
            'multiplayer.error.camera': {
                fr: 'La caméra n\'a pas pu être ouverte',
                en: 'The camera could not be opened',
                it: 'Impossibile aprire la fotocamera',
                es: 'No se pudo abrir la cámara'
            },
            'multiplayer.waiting': {
                fr: 'En attente de {nickname}…',
                en: 'Waiting for {nickname}…',
                it: 'In attesa di {nickname}…',
                es: 'Esperando a {nickname}…'
            },
            'multiplayer.playerLeft': {
                fr: '{nickname} a quitté la partie',
                en: '{nickname} left the game',
                it: '{nickname} ha lasciato la partita',
                es: '{nickname} ha dejado la partida'
            },
            'multiplayer.playerAway': {
                fr: 'Absence de {nickname}',
                en: '{nickname} is away',
                it: 'Assenza di {nickname}',
                es: 'Ausencia de {nickname}'
            },
            'multiplayer.playerBack': {
                fr: 'Retour de {nickname}',
                en: '{nickname} is back',
                it: 'Ritorno di {nickname}',
                es: 'Regreso de {nickname}'
            },
            'multiplayer.pausedByMain': {
                fr: 'Partie en pause par l\'hôte',
                en: 'Game paused by the host',
                it: 'Partita in pausa dall\'host',
                es: 'Partida en pausa por el anfitrión'
            },
            'multiplayer.end.stopped': {
                fr: 'L\'hôte a arrêté la partie',
                en: 'The host stopped the game',
                it: 'L\'host ha interrotto la partita',
                es: 'El anfitrión ha detenido la partida'
            },
            'multiplayer.end.gameOver': {
                fr: 'La partie de l\'hôte est terminée',
                en: 'The host\'s game is over',
                it: 'La partita dell\'host è finita',
                es: 'La partida del anfitrión ha terminado'
            },
            'multiplayer.end.invalid': {
                fr: 'Message réseau invalide : la session est terminée',
                en: 'Invalid network message: the session has ended',
                it: 'Messaggio di rete non valido: la sessione è terminata',
                es: 'Mensaje de red no válido: la sesión ha terminado'
            },
            'multiplayer.end.full': {
                fr: 'Le salon est complet',
                en: 'The lobby is full',
                it: 'La sala è al completo',
                es: 'La sala está completa'
            },
            'multiplayer.end.removed': {
                fr: 'L\'hôte vous a retiré de la partie',
                en: 'The host removed you from the game',
                it: 'L\'host ti ha rimosso dalla partita',
                es: 'El anfitrión te ha quitado de la partida'
            },
            'multiplayer.end.lost': {
                fr: 'La connexion avec l\'hôte a été perdue',
                en: 'The connection to the host was lost',
                it: 'La connessione con l\'host è stata persa',
                es: 'Se perdió la conexión con el anfitrión'
            },
            'multiplayer.end.timeout': {
                fr: 'La connexion avec l\'hôte est trop lente : vous avez été déconnecté',
                en: 'The connection to the host is too slow: you have been disconnected',
                it: 'La connessione con l\'host è troppo lenta: sei stato disconnesso',
                es: 'La conexión con el anfitrión es demasiado lenta: has sido desconectado'
            }
        };
    }
}
