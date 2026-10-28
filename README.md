# CO:PLAY Lounge

En kort VR-oplevelse til de to Quest 2-headset i receptionen, stærkt inspireret af Oculus' "First Contact". Gæsten sidder øverst i CO:PLAY-urtårnet ved et bord med udsigt over en neonby. Robotten CO:BOT byder velkommen, beder om en high five og kaster disketter over bordet. Når en diskette stikkes ind i maskinen, fortæller robotten om et emne, og maskinen printer noget at lege med:

| Diskette | Printer |
| --- | --- |
| Hvem er vi? | Bogstavklodser, der staver CO:PLAY |
| Jura + tech | Konfettikanon og fem skydeskiver rundt i rummet |
| Huset | Sommerfugle, der lander på en hånd, der holdes stille |
| Mens du venter | En kop kaffe med damp |

Alt kan gribes og kastes, også efter robotten. Ting, der er uden for rækkevidde, hentes ved at pege på dem og holde knappen inde.

Den er bygget som en WebXR-side (three.js og cannon-es til fysik) og kører i Quest-browseren. Der er intet byggetrin, men bibliotekerne hentes fra jsDelivr, så headsettet skal være på nettet.

## Kør lokalt

```bash
node server.mjs
```

Åbn http://localhost:8080. I en almindelig browser trækker du i baggrunden for at kigge rundt, trækker i tingene for at flytte og kaste dem og bruger scrollhjulet til at flytte en ting frem og tilbage.

## Kør på et Quest-headset via USB

Kræver udviklertilstand på headsettet (slås til i Meta Horizon-appen) og at USB-debugging er godkendt inde i brillerne.

```bash
adb devices
adb -s <serienummer> reverse tcp:8080 tcp:8080
adb -s <serienummer> shell am start -a android.intent.action.VIEW -d http://localhost:8080 com.oculus.browser
```

`adb reverse` gør, at headsettet kan nå serveren på pc'en som `localhost`. Det tæller som en sikker adresse, så WebXR virker uden HTTPS. Tryk derefter på "Start oplevelsen" i brillerne.

## Styring i VR

- **Grib:** grebknappen på siden af controlleren eller aftrækkeren. Med hænderne: knib tommel og pegefinger sammen.
- **Kast:** sving armen og giv slip.
- **Hent på afstand:** peg på en ting og grib, så flyver den hen i hånden.
- **Konfettikanonen** skyder af sig selv, så længe den holdes.

## Ret tekster og indhold

- Alle tekster: [src/content.js](src/content.js)
- Robotten og talebobblen: [src/robot.js](src/robot.js)
- Bordet, maskinen og printpladen: [src/desk.js](src/desk.js)
- Disketter, klodser, kanon, kaffe, skydeskiver, konfetti og sommerfugle: [src/items.js](src/items.js)
- Greb og kast: [src/input.js](src/input.js), fysik: [src/physics.js](src/physics.js)
- Forløbet: [src/main.js](src/main.js)
- Rummet og byen: [src/world.js](src/world.js)

## Musik og lydeffekter

Musikken og lydeffekterne ligger i `assets/audio` og er genereret med ElevenLabs. Beskrivelsen af hver lyd står i [tools/sounds.json](tools/sounds.json). Ret en beskrivelse, og lav lyden igen med:

```bash
ELEVENLABS_API_KEY=... python3 tools/generate_audio.py --force <del af filnavn>
```

Uden `--force` laves kun de filer, der mangler.

## Opførsel

- Velkomst, high five (springes over efter 14 sekunder), derefter én diskette ad gangen. Har gæsten prøvet alle fire, kommer en afslutning, og disketterne fortsætter i ring.
- Ryger en diskette på gulvet, kaster robotten en ny efter 8 sekunder.
- Rører gæsten ikke noget i 30 sekunder, kommer et tip.
- Tages headsettet af i mere end 15 sekunder, ryddes bordet, og oplevelsen starter forfra for næste gæst.
- Scenen drejes, så robotten altid står foran gæsten, når VR starter, eller når brillerne centreres igen.

## Fejlfinding

I browserens konsol findes `lounge` med de vigtigste dele. `lounge.advance(10)` spoler 10 sekunder frem uden at tegne, og `lounge.printItem('blaster')` printer en ting direkte.
