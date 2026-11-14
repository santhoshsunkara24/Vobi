//! Offline spelling correction for "Fix selection".
//!
//! Uses a Hunspell-format English dictionary (SCOWL, see
//! `dictionaries/en/LICENSE`) compiled into the binary, so it behaves the same
//! on macOS and Windows and never needs the network.
//!
//! It is deliberately conservative: a word is only changed when it is clearly
//! misspelt and the dictionary's best suggestion is a small edit away. Names,
//! acronyms, links, emails, code-like tokens and the user's own dictionary
//! words are left alone.

use once_cell::sync::Lazy;
use serde::Serialize;
use spellbook::Dictionary;

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

/// Load the dictionary ahead of time (it takes a moment to parse).
pub fn warm_up() {
    std::thread::spawn(|| {
        Lazy::force(&DICT);
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

    while i < chars.len() {
        let c = chars[i];
        if !c.is_alphabetic() {
            if matches!(c, '.' | '!' | '?' | '\n') {
                sentence_start = true;
            } else if !c.is_whitespace() && !matches!(c, '"' | '\'' | '(' | '“' | '‘') {
                sentence_start = false;
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

        match fix_word(dict, &word, &token, at_start, &custom) {
            Some(fixed) => {
                fixes.push(SpellFix {
                    from: word.clone(),
                    to: fixed.clone(),
                });
                out.push_str(&fixed);
            }
            None => out.push_str(&word),
        }
    }

    SpellResult { text: out, fixes }
}

fn looks_like_code_or_link(token: &str) -> bool {
    let t = token.trim_matches(|c: char| !c.is_alphanumeric());
    t.contains('@')
        || t.contains("://")
        || t.starts_with("www.")
        || t.contains('_')
        || t.contains('/')
        || t.contains('\\')
        || t.chars().any(|c| c.is_ascii_digit())
        || (t.contains('.') && !t.ends_with('.') && t.split('.').all(|p| !p.is_empty()))
}

fn fix_word(
    dict: &Dictionary,
    word: &str,
    token: &str,
    at_sentence_start: bool,
    custom: &[String],
) -> Option<String> {
    let n = word.chars().count();
    // Accented or non-Latin words are outside this English dictionary.
    if n < 3 || !word.is_ascii() && !word.contains('’') || looks_like_code_or_link(token) {
        return None;
    }
    if custom.iter().any(|w| w == &word.to_lowercase()) {
        return None;
    }
    let upper = word.chars().filter(|c| c.is_uppercase()).count();
    // Acronyms (NASA) and camelCase / brand-like names (iPhone, McDonald).
    if upper == n || (upper > 1) || (upper == 1 && !word.chars().next()?.is_uppercase()) {
        return None;
    }
    let capitalized = upper == 1;
    // A capitalised word mid-sentence is probably a name: leave it.
    if capitalized && !at_sentence_start {
        return None;
    }
    if dict.check(word) || (capitalized && dict.check(&word.to_lowercase())) {
        return None;
    }

    let lookup = if capitalized {
        word.to_lowercase()
    } else {
        word.to_string()
    };
    let mut suggestions = Vec::new();
    dict.suggest(&lookup, &mut suggestions);
    let best = suggestions
        .into_iter()
        .find(|s| damerau(&lookup.to_lowercase(), &s.to_lowercase()) <= 2)?;
    // Keep the original's capitalisation.
    let fixed = if capitalized {
        let mut c = best.chars();
        match c.next() {
            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            None => best,
        }
    } else {
        best
    };
    (fixed != word).then_some(fixed)
}

/// Optimal string alignment distance (insert, delete, substitute, swap).
fn damerau(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (n, m) = (a.len(), b.len());
    let mut d = vec![vec![0usize; m + 1]; n + 1];
    for (i, row) in d.iter_mut().enumerate() {
        row[0] = i;
    }
    for (j, cell) in d[0].iter_mut().enumerate() {
        *cell = j;
    }
    for i in 1..=n {
        for j in 1..=m {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            d[i][j] = (d[i - 1][j] + 1)
                .min(d[i][j - 1] + 1)
                .min(d[i - 1][j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d[i][j] = d[i][j].min(d[i - 2][j - 2] + 1);
            }
        }
    }
    d[n][m]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fix(s: &str) -> SpellResult {
        correct(s, &[])
    }

    #[test]
    fn fixes_common_typos() {
        let r = fix("I recieve teh mail tomorow.");
        assert_eq!(r.text, "I receive the mail tomorrow.");
        assert_eq!(r.fixes.len(), 3);
    }

    #[test]
    fn keeps_correct_text_untouched() {
        let s = "The quick brown fox jumps over the lazy dog.";
        let r = fix(s);
        assert_eq!(r.text, s);
        assert!(r.fixes.is_empty());
    }

    #[test]
    fn keeps_capitalisation_at_sentence_start() {
        assert_eq!(fix("Teh end.").text, "The end.");
        assert_eq!(
            fix("Thsi works. Becuase it does.").text,
            "This works. Because it does."
        );
    }

    #[test]
    fn leaves_names_acronyms_links_and_code() {
        let s = "Ask Priya at NASA, see https://exmaple.com or mail ana@exmaple.com, run my_funtion and v2beta.";
        assert_eq!(fix(s).text, s);
        assert_eq!(fix("an iPhone from Hexline").text, "an iPhone from Hexline");
    }

    #[test]
    fn respects_custom_words() {
        let r = correct("vobi is grate", &["Vobi".into()]);
        assert_eq!(r.text, "vobi is grate"); // "grate" is a real word, left alone
        let r = correct("tauri is fsat", &["tauri".into()]);
        assert_eq!(r.text, "tauri is fast");
    }

    #[test]
    fn handles_apostrophes_and_unicode() {
        assert_eq!(fix("I dont't know.").text.contains("know"), true);
        let s = "Café crème — naïve résumé.";
        assert_eq!(fix(s).text, s);
    }
}
