/**
 * Conservative common English typo map for instant local fixes.
 */
const COMMON_TYPOS: Record<string, string> = {
  hwo: 'how',
  yuo: 'you',
  yuor: 'your',
  teh: 'the',
  adn: 'and',
  nad: 'and',
  taht: 'that',
  waht: 'what',
  whihc: 'which',
  wiht: 'with',
  fo: 'of',
  ot: 'to',
  tehse: 'these',
  thier: 'their',
  recive: 'receive',
  recieve: 'receive',
  seperate: 'separate',
  definately: 'definitely',
  occured: 'occurred',
  untill: 'until',
  becuase: 'because',
  beacuse: 'because',
  freind: 'friend',
  wierd: 'weird',
  alot: 'a lot',
  dont: "don't",
  doesnt: "doesn't",
  cant: "can't",
  wont: "won't",
  isnt: "isn't",
  wasnt: "wasn't",
  arent: "aren't",
  didnt: "didn't",
  havent: "haven't",
  hasnt: "hasn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  theyre: "they're",
  weve: "we've",
}

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?/g

export function applyInstantSpelling(text: string): string {
  if (!text) return text
  const trailingIncomplete = /[A-Za-z]+(?:'[A-Za-z]+)?$/.test(text) && !/[ \t\n.!?,;:]$/.test(text)
  let cut = text.length
  if (trailingIncomplete) {
    const m = text.match(/^(.*?)([A-Za-z]+(?:'[A-Za-z]+)?)$/)
    if (m) {
      const last = m[2]!
      if (!COMMON_TYPOS[last.toLowerCase()]) {
        cut = m[1]!.length
      }
    }
  }
  const head = text.slice(0, cut)
  const tail = text.slice(cut)
  const fixedHead = head.replace(WORD_RE, (word) => {
    const key = word.toLowerCase()
    const repl = COMMON_TYPOS[key]
    if (!repl) return word
    if (word[0] === word[0]!.toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
      return repl.charAt(0).toUpperCase() + repl.slice(1)
    }
    if (word === word.toUpperCase() && word.length > 1) return repl.toUpperCase()
    return repl
  })
  return fixedHead + tail
}
