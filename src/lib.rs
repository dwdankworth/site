use wasm_bindgen::prelude::*;

mod content;
mod utils;
mod streaming;
mod commands;
mod easter_eggs;
mod matrix;
mod terminal;

#[wasm_bindgen(start)]
pub async fn main() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    terminal::init().await
}
