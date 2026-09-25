/**
 * User-facing release notes, shown in the "À propos" screen.
 *
 * Localized and child-friendly (tutoiement FR / du-form DE / casual EN) — this
 * is NOT the technical changelog. See CHANGELOG.md for the contributor-facing
 * log, and CLAUDE.md for the release ritual that keeps the two (and
 * package.json) in sync. The newest entry's `version` MUST equal package.json's
 * version, and every entry MUST carry fr/de/en notes — both enforced by
 * src/__tests__/releaseNotes.test.ts.
 */
import type { Language } from '../i18n/types';

export type ReleaseNote = {
  version: string;
  /** ISO date, YYYY-MM-DD. Shared across languages. */
  date: string;
  /** User-oriented change notes, one array per language. */
  changes: Record<Language, string[]>;
};

/** Newest first. */
export const releaseNotes: ReleaseNote[] = [
  {
    version: '1.2.0',
    date: '2026-09-25',
    changes: {
      fr: [
        "Dans Paramètres → Tes données, quand tu importes un fichier, tu peux maintenant choisir « Ajouter » : les résultats du fichier viennent s'ajouter aux tiens au lieu de les remplacer. Pratique pour réunir ce que tu as fait sur la tablette et sur l'ordinateur. « Remplacer » reste le choix par défaut.",
        "Dans « Mes résultats », la « Carte des tables » a une vraie légende : « tu sais », « à revoir », « à confirmer » et « pas joué ». Une case ne prend sa couleur qu'après 3 essais, donc la carte peut paraître moins verte qu'avant : rien n'est perdu, tes cases attendent juste d'être confirmées. Quand tu sais toute une table, sa ligne gagne une ⭐.",
        "Une bonne réponse trop lente (🐢) compte maintenant un peu dans « Paires à revoir », et le nombre de réponses lentes s'affiche à côté du score de la paire. C'est justement ce que tu t'entraînes à améliorer.",
        "Les tests papier ne sont plus enregistrés : ils servent juste à t'entraîner, et le bouton « Enregistrer le résultat » a disparu.",
        "3 × 4 et 4 × 3 comptent comme un seul calcul, donc ils ne reviennent plus deux fois plus souvent que 3 × 3.",
        "Le chrono et la page de résultats montrent maintenant exactement le temps cible (par exemple 2.5 s au lieu de 3 s) et un score comme 0.25 sans l'arrondir. Le temps affiché est arrondi vers le haut : si une réponse est marquée « trop lent », le chiffre est bien au-dessus de la cible.",
        "Dans les Paramètres, si tu vides un champ et que tu enregistres, l'ancienne valeur est gardée au lieu de passer au minimum.",
      ],
      de: [
        'Wenn du in Einstellungen → Deine Daten eine Datei importierst, kannst du jetzt « Hinzufügen » wählen: Die Ergebnisse aus der Datei kommen zu deinen dazu, statt sie zu ersetzen. Praktisch, um Tablet und Computer zusammenzuführen. « Ersetzen » bleibt die Vorauswahl.',
        'Unter « Meine Ergebnisse » hat die « Reihen-Karte » jetzt eine richtige Legende: « kannst du », « üben », « noch unsicher » und « nicht gespielt ». Ein Feld bekommt seine Farbe erst nach 3 Versuchen, darum kann die Karte weniger grün aussehen als vorher: Nichts ist verloren, deine Felder warten nur auf Bestätigung. Wenn du eine ganze Reihe kannst, bekommt ihre Zeile einen ⭐.',
        'Eine richtige, aber zu langsame Antwort (🐢) zählt jetzt ein bisschen im Abschnitt « Paare zum Üben », und die Zahl der langsamen Antworten steht neben dem Ergebnis des Paars. Genau das übst du ja.',
        'Papiertests werden nicht mehr gespeichert: Sie sind nur zum Üben da, und der Knopf « Ergebnis speichern » ist weg.',
        '3 × 4 und 4 × 3 zählen als eine Rechnung, darum kommen sie nicht mehr doppelt so oft dran wie 3 × 3.',
        'Der Timer und die Ergebnisseite zeigen jetzt genau die Zielzeit (zum Beispiel 2.5 s statt 3 s) und Punkte wie 0.25 ohne Runden. Die angezeigte Zeit wird aufgerundet: Steht bei einer Antwort « zu langsam », liegt die Zahl auch wirklich über dem Ziel.',
        'Wenn du in den Einstellungen ein Feld leerst und speicherst, bleibt der alte Wert, statt auf das Minimum zu springen.',
      ],
      en: [
        'When you import a file in Settings → Your data, you can now pick "Add": the file\'s results are added to yours instead of replacing them. Handy for bringing the tablet and the computer together. "Replace" stays the default.',
        'In "My results", the "Tables map" has a proper legend: "got it", "to review", "not sure yet" and "not played". A cell only gets its colour after 3 tries, so the map may look less green than before: nothing is lost, your cells are just waiting to be confirmed. When you know a whole table, its row gets a ⭐.',
        'A right answer that was too slow (🐢) now counts a little in "Pairs to review", and the number of slow answers shows next to the pair\'s score. That is exactly what you are practising.',
        'Paper tests are no longer saved: they are just for practice, and the "Save result" button is gone.',
        '3 × 4 and 4 × 3 count as one problem, so they no longer come up twice as often as 3 × 3.',
        'The timer and the results page now show the exact target time (say 2.5 s instead of 3 s) and a score like 0.25 without rounding. The time shown is rounded up: if an answer says "too slow", the number really is above the target.',
        'In Settings, if you clear a field and save, the old value is kept instead of dropping to the minimum.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-09-23',
    changes: {
      fr: [
        "Nouveau dans les Paramètres : « Revoir plus souvent ce qui est difficile ». Les calculs où tu t'es trompé ces derniers temps reviennent plus souvent, et ceux que tu n'as encore jamais faits passent aussi un peu plus souvent. Tu choisis : Non, Un peu ou Beaucoup (Un peu est déjà activé).",
      ],
      de: [
        'Neu in den Einstellungen: « Schwierige Rechnungen öfter üben ». Rechnungen, bei denen du dich in letzter Zeit vertan hast, kommen öfter dran, und solche, die du noch nie hattest, auch ein bisschen öfter. Du wählst: Nein, Etwas oder Viel (Etwas ist schon eingeschaltet).',
      ],
      en: [
        'New in Settings: "Practise the tricky ones more often". Problems you got wrong lately come up more often, and ones you have never had come up a little more often too. You choose: No, A bit or A lot (A bit is already on).',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-09-22',
    changes: {
      fr: [
        "Math Quizz passe en version 1.0. Rien ne change dans le jeu : l'appli est simplement assez complète pour mériter un vrai numéro 1.",
        "Dans « À propos », un nouveau lien mène au code de l'appli sur GitHub. Il est ouvert à tout le monde : si ça t'intéresse, tu peux aller voir comment Math Quizz est fabriqué — et vérifier toi-même que rien n'est envoyé sur Internet.",
      ],
      de: [
        'Math Quizz ist jetzt Version 1.0. Am Spiel ändert sich nichts: Die App ist einfach vollständig genug für eine richtige Eins.',
        'Unter « Über » führt ein neuer Link zum Code der App auf GitHub. Er ist für alle offen: Wenn es dich interessiert, kannst du nachschauen, wie Math Quizz gebaut ist — und selbst nachprüfen, dass nichts ins Internet gesendet wird.',
      ],
      en: [
        'Math Quizz is now version 1.0. Nothing changes in the game: the app is simply complete enough to deserve a proper number one.',
        'Under "About", a new link takes you to the app\'s code on GitHub. It is open to everyone: if you are curious, you can go and see how Math Quizz is built — and check for yourself that nothing is sent to the internet.',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-09-05',
    changes: {
      fr: [
        "Vous pouvez maintenant être plusieurs à utiliser l'appli sur le même appareil. Dans les Paramètres, section « Profils », crée un profil pour ton frère ou ta sœur : chacun garde ses propres réglages et ses propres résultats, et vos scores ne se mélangent plus.",
        "Dès qu'il y a deux profils, une rangée de prénoms apparaît en haut de l'accueil : tape le tien avant de lancer une session. Le nom du profil apparaît aussi dans « Mes résultats » et dans le fichier que tu exportes.",
      ],
      de: [
        'Ihr könnt die App jetzt zu mehreren auf demselben Gerät benutzen. Lege in den Einstellungen unter « Profile » ein Profil für deinen Bruder oder deine Schwester an: Jede und jeder behält eigene Einstellungen und eigene Ergebnisse, und eure Punkte vermischen sich nicht mehr.',
        'Sobald es zwei Profile gibt, erscheint oben auf der Startseite eine Reihe mit Vornamen: Tippe auf deinen, bevor du eine Runde startest. Der Profilname steht auch in « Meine Ergebnisse » und in der Datei, die du exportierst.',
      ],
      en: [
        'Several of you can now use the app on the same device. In Settings, under "Profiles", create one for your brother or sister: everyone keeps their own settings and their own results, and your scores stop getting mixed up.',
        'As soon as there are two profiles, a row of names appears at the top of the home screen: tap yours before starting a session. The profile name also shows in "My results" and in the file you export.',
      ],
    },
  },
  {
    version: '0.11.0',
    date: '2026-09-05',
    changes: {
      fr: [
        'Dans « Mes résultats », tes erreurs récentes comptent maintenant plus que les anciennes. Une paire que tu as ratée il y a longtemps mais que tu réussis à nouveau redescend vite dans « Paires à revoir » : la liste montre ce qui te pose problème en ce moment.',
      ],
      de: [
        'Unter « Meine Ergebnisse » zählen deine letzten Fehler jetzt mehr als ältere. Ein Paar, das du früher falsch hattest und jetzt wieder kannst, rutscht in « Paare zum Üben » schnell nach unten: Die Liste zeigt, was dir gerade Mühe macht.',
      ],
      en: [
        'In "My results", recent mistakes now count more than old ones. A pair you got wrong long ago but keep getting right now drops quickly down "Pairs to review", so the list shows what is giving you trouble right now.',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-09-05',
    changes: {
      fr: [
        'Tes données ne sont plus prisonnières du navigateur : dans les Paramètres, « Exporter mes données » enregistre tes réglages, tes tests et tes statistiques dans un fichier, et « Importer un fichier » les remet en place — pratique pour garder une copie ou continuer sur un autre appareil.',
      ],
      de: [
        'Deine Daten stecken nicht mehr im Browser fest: In den Einstellungen speichert « Meine Daten exportieren » deine Einstellungen, Tests und Statistiken in einer Datei, und « Datei importieren » holt sie zurück — praktisch für eine Kopie oder um auf einem anderen Gerät weiterzumachen.',
      ],
      en: [
        'Your data is no longer stuck in the browser: in Settings, "Export my data" saves your settings, tests and stats to a file, and "Import a file" puts them back — handy for keeping a copy or carrying on from another device.',
      ],
    },
  },
  {
    version: '0.9.0',
    date: '2026-06-15',
    changes: {
      fr: [
        'Les nouveautés s’affichent maintenant dans ta langue (français, allemand ou anglais) — fini les notes toujours en français.',
      ],
      de: [
        'Die Neuigkeiten erscheinen jetzt in deiner Sprache (Französisch, Deutsch oder Englisch) — keine Hinweise mehr nur auf Französisch.',
      ],
      en: [
        'What’s new now shows in your language (French, German or English) — no more notes stuck in French.',
      ],
    },
  },
  {
    version: '0.8.0',
    date: '2026-06-14',
    changes: {
      fr: [
        'Nouveau mode « Liste » : fais défiler une liste d’opérations avec leurs réponses cachées. Montre-les toutes d’un coup, ou tape une ligne pour voir une seule réponse. Le bouton « Nouvelle liste » en génère d’autres.',
      ],
      de: [
        'Neuer Modus « Liste »: Scrolle durch eine Liste von Aufgaben mit versteckten Antworten. Zeig alle auf einmal an oder tippe auf eine Zeile, um nur eine Antwort zu sehen. Mit « Neue Liste » bekommst du neue Aufgaben.',
      ],
      en: [
        'New "List" mode: scroll through a list of problems with their answers hidden. Show them all at once, or tap a row to reveal just one. The "New list" button gives you more.',
      ],
    },
  },
  {
    version: '0.7.1',
    date: '2026-06-14',
    changes: {
      fr: [
        'Si l’appli te plaît, dis-le à tes parents : depuis la page « À propos », ils peuvent la soutenir en m’offrant un café ☕.',
      ],
      de: [
        'Wenn dir die App gefällt, sag es deinen Eltern: Auf der Seite « Über » können sie die App mit einem Kaffee ☕ unterstützen.',
      ],
      en: [
        'If you like the app, tell your parents: on the "About" page they can support it with a coffee ☕.',
      ],
    },
  },
  {
    version: '0.7.0',
    date: '2026-06-14',
    changes: {
      fr: [
        'Tu peux maintenant changer la langue (FR, DE, EN) directement en haut de l’écran d’accueil, sans passer par les Paramètres.',
      ],
      de: [
        'Du kannst die Sprache (FR, DE, EN) jetzt direkt oben auf dem Startbildschirm wechseln, ohne in die Einstellungen zu gehen.',
      ],
      en: [
        'You can now switch the language (FR, DE, EN) right at the top of the home screen, without going into Settings.',
      ],
    },
  },
  {
    version: '0.6.0',
    date: '2026-06-13',
    changes: {
      fr: [
        'Nouveau mode « Entraînement » : pas de chrono. Après chaque réponse, tu vois tout de suite si c’est juste et la bonne réponse, puis tu passes à la suivante.',
        'Tes entraînements ont leur propre page de résultats : ouvre « Mes résultats » et choisis « Entraînement ».',
      ],
      de: [
        'Neuer Modus « Üben »: keine Stoppuhr. Nach jeder Antwort siehst du sofort, ob sie richtig ist und wie die richtige Antwort lautet, dann geht es zur nächsten.',
        'Deine Übungen haben ihre eigene Ergebnisseite: Öffne « Meine Ergebnisse » und wähle « Üben ».',
      ],
      en: [
        'New "Practice" mode: no timer. After each answer you see right away whether it’s correct and what the right answer is, then you go to the next one.',
        'Your practice sessions have their own results page: open "My results" and choose "Practice".',
      ],
    },
  },
  {
    version: '0.5.1',
    date: '2026-06-13',
    changes: {
      fr: [
        'Les boutons que tu as choisis (comme l’opération ou la langue) restent bien lisibles quand tu passes la souris dessus.',
      ],
      de: [
        'Die Schaltflächen, die du ausgewählt hast (wie die Rechenart oder die Sprache), bleiben gut lesbar, wenn du mit der Maus darüberfährst.',
      ],
      en: [
        'The buttons you’ve picked (like the operation or the language) stay easy to read when you hover over them.',
      ],
    },
  },
  {
    version: '0.5.0',
    date: '2026-06-13',
    changes: {
      fr: [
        'Tu peux maintenant choisir la langue : français, allemand ou anglais, dans les Paramètres.',
      ],
      de: [
        'Du kannst jetzt in den Einstellungen die Sprache wählen: Französisch, Deutsch oder Englisch.',
      ],
      en: [
        'You can now choose the language — French, German or English — in Settings.',
      ],
    },
  },
  {
    version: '0.4.0',
    date: '2026-06-13',
    changes: {
      fr: [
        "Nouvelle page « À propos » : la version de l'appli, les nouveautés, et où sont rangées tes données.",
      ],
      de: [
        'Neue Seite « Über »: die App-Version, die Neuigkeiten und wo deine Daten gespeichert sind.',
      ],
      en: [
        'New "About" page: the app version, what’s new, and where your data is kept.',
      ],
    },
  },
  {
    version: '0.3.0',
    date: '2026-06-13',
    changes: {
      fr: [
        "Installe l'appli sur ta tablette ou ton téléphone, et joue même hors connexion.",
      ],
      de: [
        'Installiere die App auf deinem Tablet oder Handy und spiele sogar ohne Internet.',
      ],
      en: [
        'Install the app on your tablet or phone, and play even when you’re offline.',
      ],
    },
  },
  {
    version: '0.2.0',
    date: '2026-06-13',
    changes: {
      fr: [
        'Nouvelle page « Mes résultats » : suis tes scores et repère les opérations à revoir.',
      ],
      de: [
        'Neue Seite « Meine Ergebnisse »: Verfolge deine Punkte und finde die Aufgaben, die du üben solltest.',
      ],
      en: [
        'New "My results" page: track your scores and spot the problems to review.',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-05-09',
    changes: {
      fr: [
        'Première version : entraînement chronométré aux tables de multiplication et de division, au clavier ou sur papier.',
      ],
      de: [
        'Erste Version: Training mit Stoppuhr für die Reihen der Multiplikation und Division, mit der Tastatur oder auf Papier.',
      ],
      en: [
        'First version: timed practice on the multiplication and division tables, with the keyboard or on paper.',
      ],
    },
  },
];
