// Alle tekster i oplevelsen på dansk og engelsk. UDKAST: ret dem til, så de passer til CO:PLAY.
// Gæsten vælger sprog først. setLanguage() skifter så alle de eksporterede tekster herunder.
// voice er robottens indtalte replik i assets/audio/voice. En liste afspilles i rækkefølge,
// og tal i listen er pauser i sekunder. Taleboblen er skjult, så replikker uden voice ses og høres ikke.

import { CVI } from './palette.js';

export const SPEAKER = 'CO:BOT · Reception';

// Vises på begge sprog, mens gæsten vælger.
export const LANGUAGE_PROMPT = {
  title: 'Dansk eller English?',
  body: 'Tryk på dit sprog. Touch your language.',
  voice: ['voice/language-1-da', 0.3, 'voice/language-2-en', 0.8, 'voice/language-3-da', 0.3, 'voice/language-4-en'],
};

export const LANGUAGES = [
  { id: 'da', label: 'DANSK' },
  { id: 'en', label: 'ENGLISH' },
];

const TEXT = {
  da: {
    SIGN: 'INDSÆT DISKETTE',

    // Robotten siger disse linjer, når sproget er valgt.
    INTRO: [
      {
        title: 'Hej og velkommen!',
        body: 'Jeg hedder CO:BOT og passer den virtuelle reception her hos CO:PLAY.',
        voice: 'voice/intro-da',
      },
      {
        title: 'Slå dig ned',
        body: 'Du er velkommen til at hænge ud her, mens du venter på dit møde. Din vært kommer og henter dig, når det er tid.',
        voice: 'voice/intro-2-da',
      },
    ],

    HIGH_FIVE: {
      title: 'Giv mig fem!',
      body: 'Ræk hånden frem og giv mig en high five.',
      voice: 'voice/highfive-da',
    },

    HIGH_FIVE_DONE: {
      title: 'Sådan!',
      body: 'Du har styr på det. Jeg har noget, du kan lege med, mens du venter.',
      voice: 'voice/highfive-done-da',
    },

    DISK_HINT: {
      title: '',
      body: 'Grib disketten på bordet med knappen på siden af controlleren, eller knib fingrene sammen. Stik den så ind i maskinen til højre.',
    },

    NEXT_DISK: {
      title: '',
      body: 'Her er en diskette mere. Sæt den i maskinen og se, hvad der sker.',
    },

    // En diskette pr. emne. Maskinen printer en ting, når disketten sættes i.
    // item: blocks | blaster | butterflies | coffee
    TOPICS: [
      {
        label: 'Hvem er vi?',
        color: CVI.cyan,
        item: 'blocks',
        title: '',
        body: 'CO:PLAY er et advokatfirma, der kombinerer juridisk rådgivning med teknologi.',
        play: { title: '', body: 'Kan du stable klodserne, så der står CO:PLAY? Du må også gerne kaste dem efter mig.' },
      },
      {
        label: 'Jura + tech',
        color: CVI.blue,
        item: 'blaster',
        title: '',
        body: 'Vi bygger selv de digitale værktøjer, vi arbejder med. Det rum, du sidder i, er også lavet her i huset.',
        play: { title: '', body: 'Tag pistolen og sigt efter de lysende ringe. Den skyder af sig selv, så længe du holder den.' },
      },
      {
        label: 'Parkering',
        color: CVI.orange,
        item: 'butterflies',
        title: '',
        body: 'Ankom du i bil? Så husk at få registreret din nummerplade i receptionen af hensyn til parkeringen.',
        play: { title: '', body: 'Ræk hånden frem og hold den helt stille. Måske lander der en sommerfugl på den.' },
      },
      {
        label: 'Mens du venter',
        color: CVI.sand,
        item: 'coffee',
        title: '',
        body: 'Tørstig? Der står kaffe og vand klar til dig i mødelokalet.',
        play: { title: '', body: 'Indtil da kan du nyde denne virtuelle kop kaffe.' },
      },
    ],

    // Når gæsten rammer robotten med noget.
    HIT_LINES: [
      { title: 'Av!', body: 'Godt kast. Men jeg er altså lavet af plastik.' },
      { title: 'Hov!', body: 'Det kildede. Prøv at sigte efter noget andet end mig.' },
      { title: 'Fuldtræffer', body: 'Okay, okay. Du sigter godt.' },
    ],

    // Vises med mellemrum, hvis gæsten ikke rører noget.
    HINTS: [
      { title: '', body: 'Sigt efter en ting og hold knappen inde, så flyver den hen til dig.' },
      { title: '', body: 'Sving armen og giv slip for at kaste.' },
      { title: '', body: 'Se ud ad vinduerne: svævetoget kører hele vejen rundt om huset.' },
    ],

    // Vises, når gæsten har prøvet alle disketterne.
    OUTRO: {
      title: 'Tak fordi du legede med',
      body: 'Du kan blive ved så længe du vil, eller tage brillerne af. Vi ses om lidt!',
    },

    // Bonusdisketter, som robotten deler ud på én gang, når gæsten har prøvet alle de første.
    // item: camera | stamp | plane | paperballs
    BONUS_TOPICS: [
      {
        label: 'Smil!',
        color: CVI.navy,
        item: 'camera',
        title: 'Et minde fra CO:PLAY',
        body: 'Vi kan godt lide at mødes, også når det er virtuelt. Lad os tage et billede sammen.',
        play: { title: 'Sig cheese', body: 'Grib kameraet og tryk på den anden knap, eller den røde knap ovenpå. Vend det mod dig selv, så kommer jeg med på billedet.' },
      },
      {
        label: 'Godkendt',
        color: CVI.orange,
        item: 'stamp',
        title: 'Jura i praksis',
        body: 'Meget af vores arbejde handler om aftaler, der skal på plads. Her er en, du selv kan godkende.',
        play: { title: 'Stempl den', body: 'Tag stemplet og tryk det ned på aftalen. Det virker også på bordet. Og på mig.' },
      },
      {
        label: 'Papirfly',
        color: CVI.cyan,
        item: 'plane',
        title: 'Lad papiret flyve',
        body: 'Hos os er papirarbejdet blevet digitalt. Så kan det gamle papir lige så godt komme ud at flyve.',
        play: { title: 'Kast blødt', body: 'Hold flyet med næsen fremad og giv slip med et roligt kast. Kan du ramme mig?' },
      },
      {
        label: 'Papirkurv',
        color: CVI.sand,
        item: 'paperballs',
        title: 'Ryd skrivebordet',
        body: 'Bunker af papir hører fortiden til. Hjælp mig med at rydde op.',
        play: { title: 'Den står bag dig', body: 'Vend dig om. Skraldespanden står bag dig. Hvor mange papirkugler kan du ramme?' },
      },
    ],

    BONUS: {
      title: 'Bonusdisketter!',
      body: 'Du har prøvet dem alle. Her er fire mere, og du bestemmer selv rækkefølgen.',
    },

    // Robottens replikker, når der sker noget med tingene.
    EVENTS: {
      painting: { title: 'Hov!', body: 'Nu hænger elgen skævt. Jeg retter den lige.' },
      vase: { title: 'Ups!', body: 'Vasen væltede. Et øjeblik, så rejser jeg den op igen.' },
      'lamp-off': { title: 'Hyggebelysning', body: 'Peg på lampen og tryk igen, så tænder den.' },
      headset: { title: 'VR i VR', body: 'Nu ser du dig selv gennem mit kamera. Vink til mig!' },
      photo: { title: 'Smukt!', body: 'Tag billedet, der kommer ud af kameraet, og se det fremkalde.' },
      contract: { title: 'Aftalen er i hus', body: 'Stemplet og godkendt. Så hurtigt kan jura også gå.' },
      'stamp-robot': { title: 'Godkendt?', body: 'Tak, tror jeg. Nu er jeg officielt godkendt.' },
      bin: { title: 'Kurv!', body: 'Flot skud. Kan du gøre det igen?' },
      'bin-five': { title: 'Ryddet!', body: 'Fem kurve! Skrivebordet har aldrig været så pænt.' },
    },
  },

  en: {
    SIGN: 'INSERT DISK',

    INTRO: [
      {
        title: 'Hi and welcome!',
        body: 'I am CO:BOT, and I look after the virtual reception here at CO:PLAY.',
        voice: 'voice/intro-en',
      },
      {
        title: 'Make yourself at home',
        body: 'Feel free to hang out here while you wait for your meeting. Your host will come and get you when it is time.',
        voice: 'voice/intro-2-en',
      },
    ],

    HIGH_FIVE: {
      title: 'High five!',
      body: 'Reach out your hand and give me a high five.',
      voice: 'voice/highfive-en',
    },

    HIGH_FIVE_DONE: {
      title: 'Nice!',
      body: 'You have got the hang of it. I have something you can play with while you wait.',
      voice: 'voice/highfive-done-en',
    },

    DISK_HINT: {
      title: '',
      body: 'Grab the disk on the table with the button on the side of the controller, or pinch your fingers together. Then push it into the machine on the right.',
    },

    NEXT_DISK: {
      title: '',
      body: 'Here is another disk. Put it in the machine and see what happens.',
    },

    TOPICS: [
      {
        label: 'Who are we?',
        color: CVI.cyan,
        item: 'blocks',
        title: '',
        body: 'CO:PLAY is a law firm that combines legal advice with technology.',
        play: { title: '', body: 'Can you stack the blocks so they spell CO:PLAY? You are also welcome to throw them at me.' },
      },
      {
        label: 'Law + tech',
        color: CVI.blue,
        item: 'blaster',
        title: '',
        body: 'We build the digital tools we work with ourselves. The room you are sitting in was also built in-house.',
        play: { title: '', body: 'Take the gun and aim at the glowing rings. It fires on its own as long as you hold it.' },
      },
      {
        label: 'Parking',
        color: CVI.orange,
        item: 'butterflies',
        title: '',
        body: 'Did you arrive by car? Then remember to have your licence plate registered at the reception for parking.',
        play: { title: '', body: 'Reach out your hand and keep it completely still. Maybe a butterfly will land on it.' },
      },
      {
        label: 'While you wait',
        color: CVI.sand,
        item: 'coffee',
        title: '',
        body: 'Thirsty? There is coffee and water waiting for you in the meeting room.',
        play: { title: '', body: 'Until then, enjoy this virtual cup of coffee.' },
      },
    ],

    HIT_LINES: [
      { title: 'Ouch!', body: 'Nice throw. But I am made of plastic, you know.' },
      { title: 'Hey!', body: 'That tickled. Try aiming at something other than me.' },
      { title: 'Bullseye', body: 'Okay, okay. You have good aim.' },
    ],

    HINTS: [
      { title: '', body: 'Point at something and hold the button, and it flies over to you.' },
      { title: '', body: 'Swing your arm and let go to throw.' },
      { title: '', body: 'Look out the windows: the monorail goes all the way around the house.' },
    ],

    OUTRO: {
      title: 'Thanks for playing',
      body: 'You can keep going as long as you like, or take off the headset. See you soon!',
    },

    BONUS_TOPICS: [
      {
        label: 'Smile!',
        color: CVI.navy,
        item: 'camera',
        title: 'A souvenir from CO:PLAY',
        body: 'We like meeting people, even when it is virtual. Let us take a picture together.',
        play: { title: 'Say cheese', body: 'Grab the camera and press the other button, or the red button on top. Turn it towards yourself, and I will join you in the picture.' },
      },
      {
        label: 'Approved',
        color: CVI.orange,
        item: 'stamp',
        title: 'Law in practice',
        body: 'Much of our work is about getting agreements in place. Here is one you can approve yourself.',
        play: { title: 'Stamp it', body: 'Take the stamp and press it down on the agreement. It works on the table too. And on me.' },
      },
      {
        label: 'Paper plane',
        color: CVI.cyan,
        item: 'plane',
        title: 'Let the paper fly',
        body: 'Our paperwork has gone digital. So the old paper might as well go flying.',
        play: { title: 'Throw gently', body: 'Hold the plane nose first and let go with a calm throw. Can you hit me?' },
      },
      {
        label: 'Waste basket',
        color: CVI.sand,
        item: 'paperballs',
        title: 'Clear the desk',
        body: 'Piles of paper are a thing of the past. Help me tidy up.',
        play: { title: 'It is behind you', body: 'Turn around. The waste basket is right behind you. How many paper balls can you get in?' },
      },
    ],

    BONUS: {
      title: 'Bonus disks!',
      body: 'You have tried them all. Here are four more, and you choose the order.',
    },

    EVENTS: {
      painting: { title: 'Oops!', body: 'Now the moose is hanging crooked. Let me fix that.' },
      vase: { title: 'Whoops!', body: 'The vase fell over. One moment, I will stand it back up.' },
      'lamp-off': { title: 'Mood lighting', body: 'Point at the lamp and press again to switch it back on.' },
      headset: { title: 'VR in VR', body: 'Now you see yourself through my camera. Wave at me!' },
      photo: { title: 'Lovely!', body: 'Take the picture coming out of the camera and watch it develop.' },
      contract: { title: 'It is a deal', body: 'Stamped and approved. Law can be that quick too.' },
      'stamp-robot': { title: 'Approved?', body: 'Thanks, I think. Now I am officially approved.' },
      bin: { title: 'Score!', body: 'Nice shot. Can you do it again?' },
      'bin-five': { title: 'All clear!', body: 'Five baskets! The desk has never looked this tidy.' },
    },
  },
};

// Teksterne på det valgte sprog. "export let" betyder, at de andre moduler ser skiftet.
export let SIGN;
export let INTRO;
export let HIGH_FIVE;
export let HIGH_FIVE_DONE;
export let DISK_HINT;
export let NEXT_DISK;
export let TOPICS;
export let HIT_LINES;
export let HINTS;
export let OUTRO;
export let BONUS_TOPICS;
export let BONUS;
export let EVENTS;

export function setLanguage(id) {
  ({
    SIGN, INTRO, HIGH_FIVE, HIGH_FIVE_DONE, DISK_HINT, NEXT_DISK, TOPICS, HIT_LINES, HINTS, OUTRO, BONUS_TOPICS, BONUS, EVENTS,
  } = TEXT[id] ?? TEXT.da);
}

setLanguage('da');

// Hver replik får et lydspor (voice/<navn>-<sprog>), hvis den ikke har et i forvejen,
// fx voice/topic-2-play-en. tools/generate_voice.mjs indtaler de spor, der mangler.
const VOICE_NAMES = {
  INTRO: 'intro', HIGH_FIVE: 'highfive', HIGH_FIVE_DONE: 'highfive-done', DISK_HINT: 'disk-hint',
  NEXT_DISK: 'next-disk', TOPICS: 'topic', HIT_LINES: 'hit', HINTS: 'hint', OUTRO: 'outro',
  BONUS_TOPICS: 'bonus', BONUS: 'bonus-intro',
};
export const VOICE_LINES = []; // { voice, lang, text } til generatoren
for (const [lang, text] of Object.entries(TEXT)) {
  const add = (line, name) => {
    line.voice ??= `voice/${name}-${lang}`;
    const title = !line.title || /[.!?]$/.test(line.title) ? line.title : `${line.title}.`;
    VOICE_LINES.push({ voice: line.voice, lang, text: title ? `${title} ${line.body}` : line.body });
  };
  for (const [key, name] of Object.entries(VOICE_NAMES)) {
    const value = text[key];
    [].concat(value).forEach((line, i) => {
      const lineName = Array.isArray(value) ? `${name}-${i + 1}` : name;
      add(line, lineName);
      if (line.play) add(line.play, `${lineName}-play`);
    });
  }
  for (const [key, line] of Object.entries(text.EVENTS)) add(line, `event-${key}`);
}

// Alle indtalte replikker på begge sprog, så de kan hentes på forhånd.
export const VOICE_FILES = [];
(function collect(value) {
  if (typeof value === 'string' && value.startsWith('voice/')) VOICE_FILES.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
})([LANGUAGE_PROMPT, TEXT]);
