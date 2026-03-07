use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use std::cell::RefCell;
use std::rc::Rc;

pub fn matrix_rain(duration_ms: Option<u32>) {
    let duration = duration_ms.unwrap_or(4000);
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    let body = document.body().unwrap();

    let canvas: web_sys::HtmlCanvasElement = document
        .create_element("canvas")
        .unwrap()
        .dyn_into()
        .unwrap();
    canvas.set_id("matrix-canvas");
    body.append_child(&canvas).unwrap();

    let width = window.inner_width().unwrap().as_f64().unwrap() as u32;
    let height = window.inner_height().unwrap().as_f64().unwrap() as u32;
    canvas.set_width(width);
    canvas.set_height(height);

    let ctx: web_sys::CanvasRenderingContext2d = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into()
        .unwrap();

    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";
    let font_size: f64 = 14.0;
    let columns = (width as f64 / font_size).floor() as usize;
    let drops = Rc::new(RefCell::new(vec![1.0_f64; columns]));

    let w = width as f64;
    let h = height as f64;
    let ctx = Rc::new(ctx);
    let canvas = Rc::new(canvas);

    let ctx_draw = Rc::clone(&ctx);
    let drops_draw = Rc::clone(&drops);
    let chars_owned: Vec<char> = chars.chars().collect();

    let draw = Closure::wrap(Box::new(move || {
        ctx_draw.set_fill_style_str("rgba(26, 26, 46, 0.05)");
        ctx_draw.fill_rect(0.0, 0.0, w, h);
        ctx_draw.set_fill_style_str("#7ec89b");
        ctx_draw.set_font("14px JetBrains Mono, monospace");

        let mut drops = drops_draw.borrow_mut();
        let char_count = chars_owned.len();
        for i in 0..drops.len() {
            let idx = (js_sys::Math::random() * char_count as f64).floor() as usize;
            let ch = chars_owned[idx];
            let x = i as f64 * font_size;
            let y = drops[i] * font_size;
            let s = String::from(ch);
            ctx_draw.fill_text(&s, x, y).unwrap();
            if y > h && js_sys::Math::random() > 0.975 {
                drops[i] = 0.0;
            }
            drops[i] += 1.0;
        }
    }) as Box<dyn FnMut()>);

    let interval_id = window
        .set_interval_with_callback_and_timeout_and_arguments_0(
            draw.as_ref().unchecked_ref(),
            33,
        )
        .unwrap();

    let canvas_cleanup = Rc::clone(&canvas);
    let window_cleanup = web_sys::window().unwrap();
    let cleanup = Closure::wrap(Box::new(move || {
        window_cleanup.clear_interval_with_handle(interval_id);
        canvas_cleanup.remove();
    }) as Box<dyn FnMut()>);

    window
        .set_timeout_with_callback_and_timeout_and_arguments_0(
            cleanup.as_ref().unchecked_ref(),
            duration as i32,
        )
        .unwrap();

    draw.forget();
    cleanup.forget();
}
