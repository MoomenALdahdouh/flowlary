/**
 * Spell lexicon for local English repair. Larger than the layout-remap list.
 * Earlier entries win ties (higher frequency).
 */
const SPELL_WORDS = `
the be to of and a in that have I it for not on with he as you do at
this but his by from they we say her she or an will my one all would there
their what so up out if about who get which go me when make can like time
no just him know take people into year your good some could them see other
than then now look only come its over think also back after use two how
our work first well way even new want because any these give day most us
hello hi hey please thanks thank sorry okay need help helping helped helps how are you coming
manual testing setup guide step steps test tests tested
message messages email file files page pages project projects
document documents instruction instructions tutorial check
install installation config configuration account password
receive separate definitely occurred until because friend weird
really tomorrow dashboard feature write night beach coming
please wait send save load login search find contact home
team meeting meetings issue issues bug error errors ready
update language keyboard layout typing english arabic text
sentence correct wrong true false trying getting making
today later morning afternoon evening world friend
hello please thanks okay yeah
about after again against all almost already also always
among another answer any anyone anything appear are area around
ask asked away back bad become been before began begin behind
being below best better between big both boy bring brought
call called came cannot car care carry case change children
city close come could country cut day days did didn't different
does doesn't doing done don't door down during each early
earth easy eat end enough even ever every everyone everything
example face fact family far fast father feel few find first
five follow food form found four friend from full get girl
give given going gone got great group grow had half hand
happen hard has have head hear heard her here high him himself
hold home hope house however idea important inside into isn't
it's its just keep kind knew known large last later learn
leave left less let letter life light like line little live
living long look looked looking lose love made make man many
may maybe mean men might mind miss money more most mother
move much must name near never next night nothing number
off often old once one only open other our out over own
paper part people person picture place play point put
question quite rather read real really right room run said
same saw say school see seem seen set several she should
show side since small some someone something sometimes soon
sound still stop stopped stopping story study such sun sure take taken talk
complete completed completing completely couple copy copied
tell than thank that that's their them then there these they
thing things think this those though thought three through
time times today together told too took top toward try turn
two under until upon use used using very want wanted was
water way well went were what when where whether which while
white who whole why will with without woman word words work
world would write year years yes yet you'd you'll you're
young your
fine working worked component components code coding
current currently already also
guide guild guitar
setup step steps
manual annually
`.trim()

const SPELL_LIST = [...new Set(SPELL_WORDS.split(/\s+/).map((word) => word.toLocaleLowerCase()))]

export const ENGLISH_SPELL_RANK = new Map(SPELL_LIST.map((word, index) => [word, index]))

export function englishSpellCandidates(): readonly string[] {
  return SPELL_LIST
}

export function isSpellDictionaryWord(word: string): boolean {
  return ENGLISH_SPELL_RANK.has(word.toLocaleLowerCase())
}
