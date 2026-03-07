use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlElement, HtmlInputElement, KeyboardEvent, MouseEvent};

thread_local! {
    static HISTORY: RefCell<Vec<String>> = const { RefCell::new(Vec::new()) };
    static HISTORY_IDX: RefCell<i32> = const { RefCell::new(-1) };
    static IS_STREAMING: RefCell<bool> = const { RefCell::new(false) };
}

// ── DOM helpers ──────────────────────────────────────────────────────

fn get_document() -> web_sys::Document {
    web_sys::window().unwrap().document().unwrap()
}

fn get_output() -> HtmlElement {
    get_document()
        .get_element_by_id("terminal-output")
        .unwrap()
        .dyn_into()
        .unwrap()
}

fn get_input() -> HtmlInputElement {
    get_document()
        .get_element_by_id("terminal-input")
        .unwrap()
        .dyn_into()
        .unwrap()
}

fn echo_command(cmd: &str) {
    let doc = get_document();
    let output = get_output();
    let line: HtmlElement = doc.create_element("div").unwrap().dyn_into().unwrap();
    line.set_class_name("output-line command-echo");
    line.set_inner_html(&format!(
        "<span class=\"prompt-echo\">visitor@danksite ~ $</span> {}",
        crate::utils::escape_html(cmd)
    ));
    output.append_child(&line).unwrap();
    scroll_to_bottom();
}

fn add_output_block() -> HtmlElement {
    let doc = get_document();
    let output = get_output();
    let block: HtmlElement = doc.create_element("div").unwrap().dyn_into().unwrap();
    block.set_class_name("output-line");
    output.append_child(&block).unwrap();
    block
}

fn add_blank_line() {
    let doc = get_document();
    let output = get_output();
    output
        .append_child(&doc.create_element("br").unwrap())
        .unwrap();
}

fn scroll_to_bottom() {
    let output = get_output();
    output.set_scroll_top(output.scroll_height());
}

// ── Fuzzy matching ──────────────────────────────────────────────────

fn find_closest_command(input: &str) -> Option<String> {
    let names = crate::commands::with_registry(|r| {
        r.all_visible()
            .iter()
            .map(|(name, _)| name.to_string())
            .collect::<Vec<_>>()
    });
    let mut best: Option<String> = None;
    let mut best_dist = usize::MAX;
    for name in &names {
        let d = crate::utils::levenshtein(&input.to_lowercase(), &name.to_lowercase());
        if d < best_dist && d <= 3 {
            best_dist = d;
            best = Some(name.clone());
        }
    }
    best
}

// ── Command execution ───────────────────────────────────────────────

async fn execute(raw_input: String) {
    let trimmed = raw_input.trim().to_string();
    if trimmed.is_empty() {
        return;
    }

    HISTORY.with(|h| h.borrow_mut().insert(0, trimmed.clone()));
    HISTORY_IDX.with(|idx| *idx.borrow_mut() = -1);

    echo_command(&trimmed);
    add_blank_line();

    let parts: Vec<String> = trimmed.split_whitespace().map(String::from).collect();
    let mut cmd_name = parts[0].to_lowercase();
    let mut args: Vec<String> = parts[1..].to_vec();

    if cmd_name == "hire"
        && args
            .first()
            .map(|s| s.to_lowercase() == "me")
            .unwrap_or(false)
    {
        cmd_name = "hire me".to_string();
        args = args[1..].to_vec();
    }

    let cmd_exists = crate::commands::with_registry(|r| r.get(&cmd_name).is_some());
    let input_el = get_input();

    if !cmd_exists {
        let suggestion = find_closest_command(&cmd_name);
        let mut msg = format!("Command not found: `{}`", cmd_name);
        if let Some(ref s) = suggestion {
            msg += &format!("\n\nDid you mean **{}**?", s);
        }
        msg += "\n\nType `help` to see available commands.";

        IS_STREAMING.with(|s| *s.borrow_mut() = true);
        input_el.set_disabled(true);

        let block = add_output_block();
        let _ = crate::streaming::stream(&block, &msg).await;

        input_el.set_disabled(false);
        IS_STREAMING.with(|s| *s.borrow_mut() = false);
        add_blank_line();
        input_el.focus().ok();
        return;
    }

    IS_STREAMING.with(|s| *s.borrow_mut() = true);
    input_el.set_disabled(true);

    match crate::commands::execute_command(&cmd_name, &args).await {
        Ok(result) => match result {
            crate::commands::CommandResult::Output(text) => {
                let block = add_output_block();
                let _ = crate::streaming::stream(&block, &text).await;
            }
            crate::commands::CommandResult::Silent => {
                get_output().set_inner_html("");
            }
            crate::commands::CommandResult::MatrixSignal => {
                crate::matrix::matrix_rain(None);
                let block = add_output_block();
                let _ =
                    crate::streaming::stream(&block, "Follow the white rabbit... 🐇").await;
            }
        },
        Err(err) => {
            let block = add_output_block();
            let err_msg = err.as_string().unwrap_or_else(|| "Unknown error".to_string());
            let _ = crate::streaming::stream(&block, &format!("Error: {}", err_msg)).await;
        }
    }

    add_blank_line();
    input_el.set_disabled(false);
    IS_STREAMING.with(|s| *s.borrow_mut() = false);
    input_el.focus().ok();
}

// ── Initialization ──────────────────────────────────────────────────

pub async fn init() -> Result<(), JsValue> {
    crate::commands::init_registry();

    let document = get_document();
    let input_el = get_input();
    let terminal_el = document
        .get_element_by_id("terminal")
        .ok_or_else(|| JsValue::from_str("terminal element not found"))?;

    // ── Keydown listener on input ──
    {
        let input_ref = input_el.clone();
        let keydown = Closure::wrap(Box::new(move |e: KeyboardEvent| {
            let streaming = IS_STREAMING.with(|s| *s.borrow());
            if streaming {
                e.prevent_default();
                return;
            }
            let key = e.key();
            match key.as_str() {
                "Enter" => {
                    e.prevent_default();
                    let val = input_ref.value();
                    input_ref.set_value("");
                    spawn_local(async move {
                        execute(val).await;
                    });
                }
                "ArrowUp" => {
                    e.prevent_default();
                    let val = HISTORY.with(|h| {
                        let history = h.borrow();
                        if history.is_empty() {
                            return None;
                        }
                        HISTORY_IDX.with(|idx| {
                            let mut i = idx.borrow_mut();
                            if *i < (history.len() as i32 - 1) {
                                *i += 1;
                                Some(history[*i as usize].clone())
                            } else {
                                None
                            }
                        })
                    });
                    if let Some(v) = val {
                        input_ref.set_value(&v);
                    }
                }
                "ArrowDown" => {
                    e.prevent_default();
                    let val = HISTORY_IDX.with(|idx| {
                        let mut i = idx.borrow_mut();
                        if *i > 0 {
                            *i -= 1;
                            HISTORY.with(|h| Some(h.borrow()[*i as usize].clone()))
                        } else {
                            *i = -1;
                            None
                        }
                    });
                    match val {
                        Some(v) => input_ref.set_value(&v),
                        None => input_ref.set_value(""),
                    }
                }
                "Tab" => {
                    e.prevent_default();
                    let partial = input_ref.value();
                    let partial = partial.trim().to_lowercase();
                    if partial.is_empty() {
                        return;
                    }
                    let names = crate::commands::with_registry(|r| {
                        r.all_visible()
                            .iter()
                            .map(|(name, _)| name.to_string())
                            .collect::<Vec<_>>()
                    });
                    let matches: Vec<&String> =
                        names.iter().filter(|n| n.starts_with(&partial)).collect();
                    if matches.len() == 1 {
                        input_ref.set_value(&format!("{} ", matches[0]));
                    }
                }
                _ => {}
            }
        }) as Box<dyn FnMut(_)>);
        input_el
            .add_event_listener_with_callback("keydown", keydown.as_ref().unchecked_ref())?;
        keydown.forget();
    }

    // ── Click listener on terminal container ──
    {
        let input_for_click = input_el.clone();
        let click = Closure::wrap(Box::new(move |_: MouseEvent| {
            let window = web_sys::window().unwrap();
            let has_selection = window
                .get_selection()
                .ok()
                .flatten()
                .map(|s| {
                    let obj: &js_sys::Object = s.unchecked_ref();
                    String::from(obj.to_string())
                })
                .unwrap_or_default();
            if has_selection.is_empty() {
                input_for_click.focus().ok();
            }
        }) as Box<dyn FnMut(_)>);
        terminal_el
            .add_event_listener_with_callback("click", click.as_ref().unchecked_ref())?;
        click.forget();
    }

    // ── Chip click listeners ──
    {
        let chips = document.query_selector_all(".chip[data-cmd]")?;
        for i in 0..chips.length() {
            if let Some(node) = chips.item(i) {
                let el: web_sys::Element = node.dyn_into()?;
                if let Some(cmd) = el.get_attribute("data-cmd") {
                    let chip_click = Closure::wrap(Box::new(move |_: MouseEvent| {
                        let streaming = IS_STREAMING.with(|s| *s.borrow());
                        if streaming {
                            return;
                        }
                        let cmd = cmd.clone();
                        spawn_local(async move {
                            execute(cmd).await;
                        });
                    }) as Box<dyn FnMut(_)>);
                    el.add_event_listener_with_callback(
                        "click",
                        chip_click.as_ref().unchecked_ref(),
                    )?;
                    chip_click.forget();
                }
            }
        }
    }

    // ── Load and stream welcome message ──
    match crate::content::load_content().await {
        Ok(content) => {
            let block = add_output_block();
            IS_STREAMING.with(|s| *s.borrow_mut() = true);
            input_el.set_disabled(true);
            crate::streaming::stream(&block, &content.welcome).await?;
            add_blank_line();
            input_el.set_disabled(false);
            IS_STREAMING.with(|s| *s.borrow_mut() = false);
            input_el.focus().ok();
        }
        Err(_) => {
            let block = add_output_block();
            block.set_text_content(Some(
                "Welcome to DankSite. Type \"help\" to get started.",
            ));
        }
    }

    Ok(())
}
