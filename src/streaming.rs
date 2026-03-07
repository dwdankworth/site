use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{Document, HtmlElement, Node};

const DEFAULT_DELAY: i32 = 25;
const CHUNK_SIZE_MIN: usize = 1;
const CHUNK_SIZE_MAX: usize = 3;

pub async fn stream(target: &HtmlElement, text: &str) -> Result<(), JsValue> {
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    let parsed = parse_markup(&document, text);

    let cursor = document.create_element("span")?;
    cursor.set_class_name("streaming-cursor");
    target.append_child(&cursor)?;

    let mut i = 0;
    while i < parsed.len() {
        let chunk_size = CHUNK_SIZE_MIN
            + (js_sys::Math::random() * (CHUNK_SIZE_MAX - CHUNK_SIZE_MIN + 1) as f64) as usize;
        let end = (i + chunk_size).min(parsed.len());
        while i < end {
            target.insert_before(&parsed[i], Some(&cursor))?;
            i += 1;
        }
        scroll_terminal();
        let jitter = DEFAULT_DELAY as f64 + (js_sys::Math::random() * 15.0 - 7.0);
        sleep_ms(jitter.max(5.0) as i32).await;
    }

    cursor.remove();
    Ok(())
}

pub fn parse_markup(document: &Document, text: &str) -> Vec<Node> {
    let mut nodes: Vec<Node> = Vec::new();
    let lines: Vec<&str> = text.split('\n').collect();

    for (line_idx, line) in lines.iter().enumerate() {
        if line_idx > 0 {
            nodes.push(document.create_element("br").unwrap().into());
        }

        if let Some(header_text) = line.strip_prefix("## ") {
            let span = document.create_element("span").unwrap();
            span.set_class_name("section-header");
            span.set_text_content(Some(header_text));
            nodes.push(span.into());
            continue;
        }

        if line.trim() == "---" {
            let span = document.create_element("span").unwrap();
            span.set_class_name("separator");
            span.set_text_content(Some(&"─".repeat(40)));
            nodes.push(span.into());
            continue;
        }

        let tokens = tokenize(line);
        for token in &tokens {
            nodes.push(token_to_node(document, token));
        }
    }

    nodes
}

fn tokenize(line: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = line.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // Bold: **...**
        if i + 1 < len && chars[i] == '*' && chars[i + 1] == '*' {
            if let Some(end) = find_closing_double_star(&chars, i + 2) {
                let token: String = chars[i..=end + 1].iter().collect();
                tokens.push(token);
                i = end + 2;
                continue;
            }
        }

        // Code: `...`
        if chars[i] == '`' {
            if let Some(end) = find_closing_char(&chars, i + 1, '`') {
                let token: String = chars[i..=end].iter().collect();
                tokens.push(token);
                i = end + 1;
                continue;
            }
        }

        // Link: [text](url)
        if chars[i] == '[' {
            if let Some(link_end) = try_parse_link(&chars, i) {
                let token: String = chars[i..=link_end].iter().collect();
                tokens.push(token);
                i = link_end + 1;
                continue;
            }
        }

        // Whitespace run
        if chars[i].is_whitespace() {
            let start = i;
            while i < len && chars[i].is_whitespace() {
                i += 1;
            }
            let token: String = chars[start..i].iter().collect();
            tokens.push(token);
            continue;
        }

        // Non-whitespace word (stop at special starts too)
        let start = i;
        i += 1;
        while i < len && !chars[i].is_whitespace() {
            // Break if we hit a special pattern start
            if chars[i] == '`' {
                break;
            }
            if chars[i] == '[' {
                break;
            }
            if i + 1 < len && chars[i] == '*' && chars[i + 1] == '*' {
                break;
            }
            i += 1;
        }
        let token: String = chars[start..i].iter().collect();
        tokens.push(token);
    }

    tokens
}

fn find_closing_double_star(chars: &[char], start: usize) -> Option<usize> {
    let len = chars.len();
    let mut i = start;
    while i + 1 < len {
        if chars[i] == '*' && chars[i + 1] == '*' {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn find_closing_char(chars: &[char], start: usize, ch: char) -> Option<usize> {
    (start..chars.len()).find(|&i| chars[i] == ch)
}

fn try_parse_link(chars: &[char], start: usize) -> Option<usize> {
    // Expect [text](url)
    let len = chars.len();
    if start >= len || chars[start] != '[' {
        return None;
    }
    // Find closing ]
    let mut i = start + 1;
    while i < len && chars[i] != ']' {
        i += 1;
    }
    if i >= len {
        return None;
    }
    // Expect ( immediately after ]
    let paren_start = i + 1;
    if paren_start >= len || chars[paren_start] != '(' {
        return None;
    }
    // Find closing )
    let mut j = paren_start + 1;
    while j < len && chars[j] != ')' {
        j += 1;
    }
    if j >= len {
        return None;
    }
    Some(j)
}

fn token_to_node(document: &Document, token: &str) -> Node {
    // Bold: **text**
    if token.starts_with("**") && token.ends_with("**") && token.len() > 4 {
        let span = document.create_element("span").unwrap();
        span.set_class_name("text-bold text-highlight");
        span.set_text_content(Some(&token[2..token.len() - 2]));
        return span.into();
    }

    // Code: `text`
    if token.starts_with('`') && token.ends_with('`') && token.len() > 2 {
        let span = document.create_element("span").unwrap();
        span.set_class_name("text-accent");
        span.set_text_content(Some(&token[1..token.len() - 1]));
        return span.into();
    }

    // Link: [text](url)
    if token.starts_with('[') && token.ends_with(')') {
        if let Some(bracket_end) = token.find("](") {
            let text = &token[1..bracket_end];
            let url = &token[bracket_end + 2..token.len() - 1];
            let a = document.create_element("a").unwrap();
            a.set_attribute("href", url).unwrap();
            a.set_attribute("target", "_blank").unwrap();
            a.set_attribute("rel", "noopener noreferrer").unwrap();
            a.set_text_content(Some(text));
            return a.into();
        }
    }

    // Plain text
    document.create_text_node(token).into()
}

fn scroll_terminal() {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            if let Some(el) = document.get_element_by_id("terminal-output") {
                if let Ok(html_el) = el.dyn_into::<HtmlElement>() {
                    html_el.set_scroll_top(html_el.scroll_height());
                }
            }
        }
    }
}

async fn sleep_ms(ms: i32) {
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms)
            .unwrap();
    });
    wasm_bindgen_futures::JsFuture::from(promise).await.unwrap();
}
