// Alle tekster i oplevelsen på dansk og engelsk. UDKAST: ret dem til, så de passer til CO:PLAY.
// Gæsten vælger sprog først. setLanguage() skifter så alle de eksporterede tekster herunder.
// voice er robottens indtalte replik i assets/audio/voice. En liste afspilles i rækkefølge,
// og tal i listen er pauser i sekunder. Replikker uden voice vises kun i talebobblen.

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
      title: 'Tag disketten',
      body: 'Grib disketten på bordet med knappen på siden af controlleren, eller knib fingrene sammen. Stik den så ind i maskinen til højre.',
    },

    NEXT_DISK: {
      title: 'Én til?',
      body: 'Her er en diskette mere. Sæt den i maskinen og se, hvad den laver.',
    },

    // En diskette pr. emne. Maskinen printer en ting, når disketten sættes i.
    // item: blocks | blaster | butterflies | coffee
    TOPICS: [
      {
        label: 'Hvem er vi?',
        color: CVI.cyan,
        item: 'blocks',
        title: 'Hvem er vi?',
        body: 'CO:PLAY er et advokatfirma, der kombinerer juridisk rådgivning med teknologi. Skriv jeres egen præsentation her.',
        play: { title: 'Byg løs', body: 'Kan du stable klodserne, så der står CO:PLAY? Du må også gerne kaste dem efter mig.' },
      },
      {
        label: 'Jura + tech',
        color: CVI.blue,
        item: 'blaster',
        title: 'Jura møder teknologi',
        body: 'Vi bygger selv de digitale værktøjer, vi arbejder med. Det rum, du sidder i, er også lavet her i huset.',
        play: { title: 'Konfettikanon', body: 'Tag kanonen og sigt efter de lysende ringe. Den skyder af sig selv, så længe du holder den.' },
      },
      {
        label: 'Huset',
        color: CVI.orange,
        item: 'butterflies',
        title: 'Et gammelt hus i en ny by',
        body: 'Gamle mursten, varmt lys i vinduerne og en by i fuld fart udenfor. Sådan ser vi gerne os selv.',
        play: { title: 'Hold hånden stille', body: 'Ræk hånden frem og hold den helt stille. Måske lander der en sommerfugl på den.' },
      },
      {
        label: 'Mens du venter',
        color: CVI.sand,
        item: 'coffee',
        title: 'Mens du venter',
        body: 'Din vært kommer og henter dig om lidt. Spørg gerne i receptionen, hvis du vil have kaffe eller vand.',
        play: { title: 'Kaffe?', body: 'Her er en virtuel kop kaffe til at starte med. Den rigtige får du i receptionen.' },
      },
    ],

    // Når gæsten rammer robotten med noget.
    HIT_LINES: [
      { title: 'Av!', body: 'Godt kast. Men jeg er altså lavet af plastik.' },
      { title: 'Hov!', body: 'Det kildede. Prøv at ramme ringene i stedet.' },
      { title: 'Fuldtræffer', body: 'Okay, okay. Du sigter godt.' },
    ],

    // Vises med mellemrum, hvis gæsten ikke rører noget.
    HINTS: [
      { title: 'Prøv selv', body: 'Peg på en ting og hold knappen inde, så flyver den hen til dig.' },
      { title: 'Kast den', body: 'Sving armen og giv slip for at kaste. Det er helt okay at ramme mig.' },
      { title: 'Kig ud', body: 'Se ud ad vinduerne: svævetoget kører hele vejen rundt om huset.' },
    ],

    // Vises, når gæsten har prøvet alle disketterne.
    OUTRO: {
      title: 'Tak fordi du legede med',
      body: 'Du kan blive ved så længe du vil, eller tage brillerne af. Vi ses om lidt!',
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
      title: 'Take the disk',
      body: 'Grab the disk on the table with the button on the side of the controller, or pinch your fingers together. Then push it into the machine on the right.',
    },

    NEXT_DISK: {
      title: 'Another one?',
      body: 'Here is another disk. Put it in the machine and see what it does.',
    },

    TOPICS: [
      {
        label: 'Who are we?',
        color: CVI.cyan,
        item: 'blocks',
        title: 'Who are we?',
        body: 'CO:PLAY is a law firm that combines legal advice with technology. Write your own introduction here.',
        play: { title: 'Build away', body: 'Can you stack the blocks so they spell CO:PLAY? You are also welcome to throw them at me.' },
      },
      {
        label: 'Law + tech',
        color: CVI.blue,
        item: 'blaster',
        title: 'Law meets technology',
        body: 'We build the digital tools we work with ourselves. The room you are sitting in was made here in house too.',
        play: { title: 'Confetti cannon', body: 'Take the cannon and aim at the glowing rings. It fires on its own as long as you hold it.' },
      },
      {
        label: 'The house',
        color: CVI.orange,
        item: 'butterflies',
        title: 'An old house in a new city',
        body: 'Old bricks, warm light in the windows and a city in full swing outside. That is how we like to see ourselves.',
        play: { title: 'Hold your hand still', body: 'Reach out your hand and keep it completely still. Maybe a butterfly will land on it.' },
      },
      {
        label: 'While you wait',
        color: CVI.sand,
        item: 'coffee',
        title: 'While you wait',
        body: 'Your host will come and get you shortly. Just ask at the reception if you would like coffee or water.',
        play: { title: 'Coffee?', body: 'Here is a virtual cup of coffee to start with. You get the real one at the reception.' },
      },
    ],

    HIT_LINES: [
      { title: 'Ouch!', body: 'Nice throw. But I am made of plastic, you know.' },
      { title: 'Hey!', body: 'That tickled. Try hitting the rings instead.' },
      { title: 'Bullseye', body: 'Okay, okay. You have good aim.' },
    ],

    HINTS: [
      { title: 'Try it', body: 'Point at something and hold the button, and it flies over to you.' },
      { title: 'Throw it', body: 'Swing your arm and let go to throw. It is totally fine to hit me.' },
      { title: 'Look outside', body: 'Look out the windows: the monorail goes all the way around the house.' },
    ],

    OUTRO: {
      title: 'Thanks for playing',
      body: 'You can keep going as long as you like, or take off the headset. See you soon!',
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

export function setLanguage(id) {
  ({ SIGN, INTRO, HIGH_FIVE, HIGH_FIVE_DONE, DISK_HINT, NEXT_DISK, TOPICS, HIT_LINES, HINTS, OUTRO } = TEXT[id] ?? TEXT.da);
}

setLanguage('da');

// Alle indtalte replikker på begge sprog, så de kan hentes på forhånd.
export const VOICE_FILES = [];
(function collect(value) {
  if (typeof value === 'string' && value.startsWith('voice/')) VOICE_FILES.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
})([LANGUAGE_PROMPT, TEXT]);
