// Alle tekster i oplevelsen. UDKAST: ret dem til, så de passer til CO:PLAY.

import { CVI } from './palette.js';

export const SPEAKER = 'CO:BOT · Reception';

// Robotten siger disse linjer, når oplevelsen starter.
export const INTRO = [
  {
    title: 'Hej og velkommen!',
    body: 'Jeg hedder CO:BOT og passer receptionen her hos CO:PLAY.',
  },
];

export const HIGH_FIVE = {
  title: 'Giv mig fem!',
  body: 'Ræk hånden frem og giv mig en high five.',
};

export const HIGH_FIVE_DONE = {
  title: 'Sådan!',
  body: 'Du har styr på det. Jeg har noget, du kan lege med, mens du venter.',
};

export const DISK_HINT = {
  title: 'Tag disketten',
  body: 'Grib disketten på bordet med knappen på siden af controlleren, eller knib fingrene sammen. Stik den så ind i maskinen til højre.',
};

export const NEXT_DISK = {
  title: 'Én til?',
  body: 'Her er en diskette mere. Sæt den i maskinen og se, hvad den laver.',
};

// En diskette pr. emne. Maskinen printer en ting, når disketten sættes i.
// item: blocks | blaster | butterflies | coffee
export const TOPICS = [
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
];

// Bonusdisketter, som robotten deler ud på én gang, når gæsten har prøvet alle de første.
// item: camera | stamp | plane | paperballs
export const BONUS_TOPICS = [
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
];

export const BONUS = {
  title: 'Bonusdisketter!',
  body: 'Du har prøvet dem alle. Her er fire mere, og du bestemmer selv rækkefølgen.',
};

// Robottens replikker, når der sker noget med tingene.
export const EVENTS = {
  painting: { title: 'Hov!', body: 'Nu hænger elgen skævt. Jeg retter den lige.' },
  vase: { title: 'Ups!', body: 'Vasen væltede. Et øjeblik, så rejser jeg den op igen.' },
  'lamp-off': { title: 'Hyggebelysning', body: 'Peg på lampen og tryk igen, så tænder den.' },
  headset: { title: 'VR i VR', body: 'Nu ser du dig selv gennem mit kamera. Vink til mig!' },
  photo: { title: 'Smukt!', body: 'Tag billedet, der kommer ud af kameraet, og se det fremkalde.' },
  contract: { title: 'Aftalen er i hus', body: 'Stemplet og godkendt. Så hurtigt kan jura også gå.' },
  'stamp-robot': { title: 'Godkendt?', body: 'Tak, tror jeg. Nu er jeg officielt godkendt.' },
  bin: { title: 'Kurv!', body: 'Flot skud. Kan du gøre det igen?' },
  'bin-five': { title: 'Ryddet!', body: 'Fem kurve! Skrivebordet har aldrig været så pænt.' },
};

// Når gæsten rammer robotten med noget.
export const HIT_LINES = [
  { title: 'Av!', body: 'Godt kast. Men jeg er altså lavet af plastik.' },
  { title: 'Hov!', body: 'Det kildede. Prøv at ramme ringene i stedet.' },
  { title: 'Fuldtræffer', body: 'Okay, okay. Du sigter godt.' },
];

// Vises med mellemrum, hvis gæsten ikke rører noget.
export const HINTS = [
  { title: 'Prøv selv', body: 'Peg på en ting og hold knappen inde, så flyver den hen til dig.' },
  { title: 'Kast den', body: 'Sving armen og giv slip for at kaste. Det er helt okay at ramme mig.' },
  { title: 'Kig ud', body: 'Se ud ad vinduerne: svævetoget kører hele vejen rundt om huset.' },
];

// Vises, når gæsten har prøvet alle disketterne.
export const OUTRO = {
  title: 'Tak fordi du legede med',
  body: 'Du kan blive ved så længe du vil, eller tage brillerne af. Vi ses om lidt!',
};
