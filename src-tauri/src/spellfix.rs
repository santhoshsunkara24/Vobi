//! Offline spelling correction for "Fix selection".
//!
//! Uses a Hunspell-format English dictionary (SCOWL, see
//! `dictionaries/en/LICENSE`) compiled into the binary, so it behaves the same
//! on macOS and Windows and never needs the network. The dictionary says which
//! words are wrong and offers candidates; Vobi ranks them itself, by how
//! people actually mistype (a missed or doubled letter, a swap, a neighbouring
//! key) and by how common each word is (`dictionaries/en/freq.txt`, see
//! `FREQ-LICENSE`). The dictionary's own order would turn "importent" into
//! "impotent".
//!
//! Fix replaces text in place with no preview, so it stays conservative: a
//! word is only changed when one fix is clearly the likeliest. Names,
//! acronyms, links, emails, code-like tokens, chat shorthand and the user's
//! own dictionary words are left alone.

use once_cell::sync::Lazy;
use serde::Serialize;
use spellbook::Dictionary;
use std::collections::HashMap;

static DICT: Lazy<Option<Dictionary>> = Lazy::new(|| {
    let aff = include_str!("../dictionaries/en/en.aff");
    let dic = include_str!("../dictionaries/en/en.dic");
    match Dictionary::new(aff, dic) {
        Ok(d) => Some(d),
        Err(e) => {
            log::error!("Could not load the spelling dictionary: {e}");
            None
        }
    }
});

/// Word -> rank (1 = most common), for the 50,000 most common words.
static RANK: Lazy<HashMap<&'static str, u32>> = Lazy::new(|| {
    include_str!("../dictionaries/en/freq.txt")
        .lines()
        .enumerate()
        .map(|(i, w)| (w, i as u32 + 1))
        .collect()
});
/// The rank of a word that isn't in the frequency list: rarer than all of it.
const RARE: u32 = 80_000;

/// Typos so common, or so short, that they're fixed straight from this list
/// (the dictionary can't rank them well, or would leave them).
const COMMON_TYPOS: &[(&str, &str)] = &[
    ("teh", "the"),
    ("hte", "the"),
    ("adn", "and"),
    ("nad", "and"),
    ("taht", "that"),
    ("thta", "that"),
    ("waht", "what"),
    ("yuo", "you"),
    ("jsut", "just"),
    ("cna", "can"),
    ("alot", "a lot"),
    ("thankyou", "thank you"),
    ("aquire", "acquire"),
    ("wierd", "weird"),
    ("im", "I'm"),
    ("ive", "I've"),
    ("dont", "don't"),
    ("cant", "can't"),
    ("didnt", "didn't"),
    ("doesnt", "doesn't"),
    ("isnt", "isn't"),
    ("wasnt", "wasn't"),
    ("werent", "weren't"),
    ("arent", "aren't"),
    ("wouldnt", "wouldn't"),
    ("couldnt", "couldn't"),
    ("shouldnt", "shouldn't"),
    ("havent", "haven't"),
    ("hasnt", "hasn't"),
    ("hadnt", "hadn't"),
    ("thats", "that's"),
    ("theyre", "they're"),
    ("youre", "you're"),
    ("wouldve", "would've"),
    ("couldve", "could've"),
    ("shouldve", "should've"),
];

/// Chat shorthand people write on purpose: never "fixed".
const SHORTHAND: &[&str] = &[
    "pls", "plz", "thx", "thnx", "btw", "lol", "lmao", "omg", "wanna", "gonna", "gotta", "kinda",
    "sorta", "dunno", "lemme", "gimme", "idk", "imo", "imho", "fyi", "asap", "tbh", "ppl", "msg",
    "msgs", "pic", "pics", "tho", "thru", "cuz", "coz", "yeah", "yep", "nope", "hmm", "haha",
    "hehe", "bday", "convo", "ya", "ur",
];

/// Words the dictionary doesn't know but Vobi does.
const KNOWN: &[&str] = &[
    "vobi", "vobi's", "ctrl", "cmd", "alt", "esc", "opt", "shift", "groq",
];

/// Capitalised words that may be fixed even mid-sentence (anything else
/// capitalised there is probably a name).
const CALENDAR: &[&str] = &[
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
];

/// Words that are never meant twice in a row ("the the"). "that that" and
/// "had had" can be right, so they aren't here.
const NEVER_TWICE: &[&str] = &[
    "the", "a", "an", "to", "of", "and", "in", "is", "for", "on", "with", "at", "my", "your",
    "our", "we", "you", "it", "this", "be", "are", "was", "will", "can", "i",
];

/// How much more likely the best fix must look than the next one; closer
/// than this, the word is left alone rather than guessed.
const CLEAR_LEAD: f64 = 0.15;
/// How much a word's commonness counts against how close it is.
const COMMONNESS: f64 = 0.15;
/// Candidates further than this from the typo aren't considered.
const MAX_COST: f64 = 1.5;

/// Load the dictionary ahead of time (it takes a moment to parse).
pub fn warm_up() {
    std::thread::spawn(|| {
        Lazy::force(&DICT);
        Lazy::force(&RANK);
    });
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SpellFix {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpellResult {
    pub text: String,
    pub fixes: Vec<SpellFix>,
}

/// Correct obvious misspellings in `text`. `custom_words` are always accepted.
pub fn correct(text: &str, custom_words: &[String]) -> SpellResult {
    let Some(dict) = DICT.as_ref() else {
        return SpellResult {
            text: text.to_string(),
            fixes: vec![],
        };
    };
    let custom: Vec<String> = custom_words.iter().map(|w| w.to_lowercase()).collect();

    let mut out = String::with_capacity(text.len());
    let mut fixes = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    // Sentence start: beginning of text or after . ! ? (plus spaces/quotes).
    let mut sentence_start = true;
    // The previous word (lowercased, as written out) and where it ended in
    // `out`, to catch "the the".
    let mut previous: Option<(String, usize)> = None;

    while i < chars.len() {
        let c = chars[i];
        if !c.is_alphabetic() {
            if matches!(c, '.' | '!' | '?' | '\n') {
                sentence_start = true;
            } else if !c.is_whitespace() && !matches!(c, '"' | '\'' | '(' | '“' | '‘') {
                sentence_start = false;
            }
            if c != ' ' {
                previous = None;
            }
            out.push(c);
            i += 1;
            continue;
        }

        // A "token" is a run of non-space characters, so links, emails and
        // code (snake_case, dotted.names) are judged as a whole.
        let mut tok_start = i;
        while tok_start > 0 && !chars[tok_start - 1].is_whitespace() {
            tok_start -= 1;
        }
        let mut tok_end = i;
        while tok_end < chars.len() && !chars[tok_end].is_whitespace() {
            tok_end += 1;
        }
        let token: String = chars[tok_start..tok_end].iter().collect();

        // The word itself: letters plus inner apostrophes.
        let mut j = i;
        while j < chars.len()
            && (chars[j].is_alphabetic()
                || ((chars[j] == '\'' || chars[j] == '’')
                    && j + 1 < chars.len()
                    && chars[j + 1].is_alphabetic()))
        {
            j += 1;
        }
        let word: String = chars[i..j].iter().collect();
        let at_start = sentence_start;
        sentence_start = false;
        i = j;

        let fixed = if looks_like_code_or_link(&token) {
            None
        } else {
            fix_pronoun_i(&word).or_else(|| fix_word(dict, &word, at_start, &custom))
        };
        let written = fixed.clone().unwrap_or_else(|| word.clone());
        let lower = written.to_lowercase();

        // "the the": drop the second one (only spaces between them).
        if let Some((prev, end)) = &previous {
            if *prev == lower && NEVER_TWICE.contains(&lower.as_str()) {
                out.truncate(*end);
                fixes.push(SpellFix {
                    from: format!("{written} {written}"),
                    to: written.clone(),
                });
                continue;
            }
        }

        if let Some(fixed) = fixed {
            fixes.push(SpellFix {
                from: word.clone(),
                to: fixed,
            });
        }
        out.push_str(&written);
        previous = Some((lower, out.len()));
    }

    SpellResult { text: out, fixes }
}

/// "i", "i'm", "i'll"… written lowercase: the pronoun is always "I".
fn fix_pronoun_i(word: &str) -> Option<String> {
    let rest = word.strip_prefix('i')?;
    let is_pronoun =
        rest.is_empty() || ["'m", "'ll", "'ve", "'d", "’m", "’ll", "’ve", "’d"].contains(&rest);
    is_pronoun.then(|| format!("I{rest}"))
}

fn looks_like_code_or_link(token: &str) -> bool {
    let t = token.trim_matches(|c: char| !c.is_alphanumeric());
    t.contains('@')
        || t.contains("://")
        || t.starts_with("www.")
        || t.contains('_')
        || t.contains('/')
        || t.contains('\\')
        || t.contains('+')
        || token.contains('`')
        // package-name-like compounds (openssl-devel); "well-known" needs no fix
        || t.contains('-')
        || t.chars().any(|c| c.is_ascii_digit())
        || (t.contains('.') && !t.ends_with('.') && t.split('.').all(|p| !p.is_empty()))
}

fn rank(word: &str) -> u32 {
    RANK.get(word).copied().unwrap_or(RARE)
}

/// `to` with its first letter made a capital (for a capitalised typo).
fn capitalise(to: &str) -> String {
    let mut c = to.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

fn fix_word(
    dict: &Dictionary,
    word: &str,
    at_sentence_start: bool,
    custom: &[String],
) -> Option<String> {
    let n = word.chars().count();
    // Accented or non-Latin words are outside this English dictionary.
    if !word.is_ascii() && !word.contains('’') {
        return None;
    }
    let lower = word.to_lowercase();
    if custom.contains(&lower) || KNOWN.contains(&lower.as_str()) {
        return None;
    }
    let upper = word.chars().filter(|c| c.is_uppercase()).count();
    // Acronyms (NASA) and camelCase / brand-like names (iPhone, McDonald).
    if upper == n || (upper > 1) || (upper == 1 && !word.chars().next()?.is_uppercase()) {
        return None;
    }
    let capitalized = upper == 1;

    if let Some((_, to)) = COMMON_TYPOS.iter().find(|(from, _)| *from == lower) {
        // Mid-sentence, a capitalised one is more likely a name.
        if capitalized && !at_sentence_start {
            return None;
        }
        return Some(if capitalized {
            capitalise(to)
        } else {
            to.to_string()
        });
    }
    // Too short to guess safely ("hw", "ot"), or shorthand on purpose.
    if n <= 3 || SHORTHAND.contains(&lower.as_str()) {
        return None;
    }
    if dict.check(word) || (capitalized && dict.check(&lower)) {
        return None;
    }
    // A capitalised word mid-sentence is probably a name: only a misspelt
    // day or month may be fixed there.
    let name_slot = capitalized && !at_sentence_start;

    let mut suggestions = Vec::new();
    dict.suggest(&lower, &mut suggestions);
    let mut scored: Vec<(f64, String)> = Vec::new();
    for s in suggestions {
        let s_lower = s.to_lowercase();
        if scored
            .iter()
            .any(|(_, seen)| seen.to_lowercase() == s_lower)
        {
            continue;
        }
        let calendar = CALENDAR.contains(&s_lower.as_str());
        let proper = s.chars().next().is_some_and(char::is_uppercase);
        if (proper && !calendar) || (name_slot && !calendar) {
            continue;
        }
        // Typos almost never hit the first letter; jargon and names often
        // look like they did ("cmake" isn't "make", "Vobi" isn't "Obi").
        if s_lower.chars().next() != lower.chars().next() {
            continue;
        }
        let parts: Vec<&str> = s_lower.split([' ', '-']).collect();
        let (cost, commonness) = if parts.len() == 1 {
            (typo_cost(&lower, &s_lower), rank(&s_lower))
        } else {
            // A missed space ("thankyou"): only into two common words.
            if parts.len() != 2 || parts.iter().any(|p| p.len() < 2 || rank(p) > 5_000) {
                continue;
            }
            let joined = parts.concat();
            let worst = parts.iter().map(|p| rank(p)).max().unwrap_or(RARE);
            (typo_cost(&lower, &joined) + 0.4, worst)
        };
        if cost > MAX_COST {
            continue;
        }
        scored.push((cost + COMMONNESS * (commonness as f64).ln(), s));
    }
    scored.sort_by(|a, b| a.0.total_cmp(&b.0));

    let (best_score, best) = scored.first()?;
    // Two fixes about as likely ("gret": great? greet? get?): leave it.
    if scored
        .get(1)
        .is_some_and(|(second, _)| second - best_score < CLEAR_LEAD)
    {
        return None;
    }
    let fixed = if capitalized {
        capitalise(best)
    } else {
        best.clone()
    };
    (fixed != word).then_some(fixed)
}

const KEYBOARD: [&str; 3] = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/// Whether two letters sit next to each other on a QWERTY keyboard.
fn adjacent_keys(a: char, b: char) -> bool {
    let at = |c: char| {
        KEYBOARD
            .iter()
            .enumerate()
            .find_map(|(row, keys)| keys.find(c).map(|col| (row as i32, col as i32)))
    };
    match (at(a), at(b)) {
        (Some((r1, c1)), Some((r2, c2))) => {
            (r1 == r2 && (c1 - c2).abs() == 1) || ((r1 - r2).abs() == 1 && (c1 - c2).abs() <= 1)
        }
        _ => false,
    }
}

fn is_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y')
}

/// How far the typo `a` is from the word `b`, weighted by how people really
/// slip: a swap, a doubled or missed letter, a vowel mix-up or a neighbouring
/// key cost less than an arbitrary change. The first letter is rarely wrong.
fn typo_cost(a: &str, b: &str) -> f64 {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (n, m) = (a.len(), b.len());
    let mut d = vec![vec![0.0f64; m + 1]; n + 1];
    for (i, row) in d.iter_mut().enumerate() {
        row[0] = i as f64;
    }
    for (j, cell) in d[0].iter_mut().enumerate() {
        *cell = j as f64 * 0.8;
    }
    for i in 1..=n {
        for j in 1..=m {
            let (x, y) = (a[i - 1], b[j - 1]);
            let substitute = if x == y {
                0.0
            } else if is_vowel(x) && is_vowel(y) {
                0.7
            } else if adjacent_keys(x, y) {
                0.8
            } else {
                1.0
            };
            // An extra letter in the typo; cheap when it doubles the last one.
            let extra = if i >= 2 && a[i - 1] == a[i - 2] {
                0.5
            } else {
                1.2
            };
            // A letter left out; cheap when it's half of a double.
            let missed = if j >= 2 && b[j - 1] == b[j - 2] {
                0.5
            } else {
                0.8
            };
            let mut best = (d[i - 1][j - 1] + substitute)
                .min(d[i - 1][j] + extra)
                .min(d[i][j - 1] + missed);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                best = best.min(d[i - 2][j - 2] + 0.5);
            }
            d[i][j] = best;
        }
    }
    let first_letter_changed =
        a.first() != b.first() && !(n > 1 && m > 1 && a[0] == b[1] && a[1] == b[0]);
    d[n][m] + if first_letter_changed { 0.5 } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fix(s: &str) -> String {
        correct(s, &[]).text
    }

    /// Typos people really make, and what Fix must turn them into.
    #[test]
    fn fixes_real_typos() {
        let cases = [
            (
                "I recieve teh mail tomorow.",
                "I receive the mail tomorrow.",
            ),
            (
                "I definately think we shoud go.",
                "I definitely think we should go.",
            ),
            (
                "It's realy importent to me.",
                "It's really important to me.",
            ),
            ("I beleive it.", "I believe it."),
            (
                "Can you sned me the docuemnt?",
                "Can you send me the document?",
            ),
            (
                "We need to finsih this by tommorrow.",
                "We need to finish this by tomorrow.",
            ),
            ("I'll do it alot faster.", "I'll do it a lot faster."),
            ("thankyou for the meeting", "thank you for the meeting"),
            ("i think i can make it", "I think I can make it"),
            ("i'm sure", "I'm sure"),
            ("the the problem is here", "the problem is here"),
            (
                "Please check teh attachmnet.",
                "Please check the attachment.",
            ),
            ("The resturant was amazng.", "The restaurant was amazing."),
            (
                "I want to aquire more knowlege.",
                "I want to acquire more knowledge.",
            ),
            ("Wednsday works for me.", "Wednesday works for me."),
            ("Lets meet on Wendesday", "Lets meet on Wednesday"),
            (
                "occured seperate accomodate neccessary",
                "occurred separate accommodate necessary",
            ),
            (
                "wierd recomend existance goverment enviroment",
                "weird recommend existence government environment",
            ),
            ("Im goign to the offce", "I'm going to the office"),
            ("I hpoe this helsp", "I hope this helps"),
            ("Thanks for yoru help", "Thanks for your help"),
            ("waht do you thnik", "what do you think"),
            ("becasue it dont work", "because it don't work"),
            ("Can we resheduel the call", "Can we reschedule the call"),
            ("Plese reveiw the desgin", "Please review the design"),
            ("This is a gret idea", "This is a great idea"),
        ];
        for (input, want) in cases {
            assert_eq!(fix(input), want, "for {input:?}");
        }
    }

    /// Wrong fixes are worse than none: these must come back unchanged.
    #[test]
    fn leaves_what_it_cant_be_sure_of() {
        for s in [
            "The quick brown fox jumps over the lazy dog.",
            "pls send it, plz. thx! wanna join? btw it's fine",
            "Hi Santhosh, hw are you doing?",
            "Ask Priya at NASA, see https://exmaple.com or mail ana@exmaple.com, run my_funtion and v2beta.",
            "an iPhone from Hexline",
            "Café crème — naïve résumé.",
            "It is what it is, and that that is fine.",
        ] {
            assert_eq!(fix(s), s, "changed {s:?}");
        }
    }

    #[test]
    fn keeps_capitalisation_at_sentence_start() {
        assert_eq!(fix("Teh end."), "The end.");
        assert_eq!(
            fix("Thsi works. Becuase it does."),
            "This works. Because it does."
        );
    }

    #[test]
    fn respects_custom_words() {
        let r = correct("vobi is grate", &["Vobi".into()]);
        assert_eq!(r.text, "vobi is grate"); // "grate" is a real word, left alone
        let r = correct("tauri is fsat", &["tauri".into()]);
        assert_eq!(r.text, "tauri is fast");
    }

    #[test]
    fn reports_each_fix() {
        let r = correct("I recieve teh the mail.", &[]);
        assert_eq!(r.text, "I receive the mail.");
        assert_eq!(r.fixes.len(), 3);
    }

    /// Precision: the app's own English text has no typos, so Fix must not
    /// change a word of it.
    #[test]
    fn leaves_correct_english_alone() {
        let json = include_str!("../../src/i18n/locales/en/translation.json");
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        let mut strings = Vec::new();
        fn walk(v: &serde_json::Value, out: &mut Vec<String>) {
            match v {
                serde_json::Value::String(s) => out.push(s.clone()),
                // The Refine demo's "before" text is messy on purpose.
                serde_json::Value::Object(m) => m
                    .iter()
                    .filter(|(k, _)| !k.ends_with("Before"))
                    .for_each(|(_, v)| walk(v, out)),
                serde_json::Value::Array(a) => a.iter().for_each(|v| walk(v, out)),
                _ => {}
            }
        }
        walk(&value, &mut strings);
        let changed: Vec<String> = strings
            .iter()
            .filter_map(|s| {
                let r = correct(s, &[]);
                (!r.fixes.is_empty()).then(|| format!("{:?}", r.fixes))
            })
            .collect();
        assert!(changed.is_empty(), "changed correct text: {changed:#?}");
    }
}
